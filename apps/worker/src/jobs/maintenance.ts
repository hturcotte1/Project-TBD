/**
 * Every `maintenance.*` job: recomputing `next_actions`, disconnecting Common App, deleting an
 * account, exporting a student's data, and sending the very first plan once onboarding items
 * exist. This file (like `src/scheduler/`) legitimately enumerates/loads by studentId outside
 * `scoped()` — it is allow-listed in the authorization scan.
 */
import { eq } from 'drizzle-orm';
import { appendAudit, AuthorizationError, conversationsRepo, messagesRepo, nudgesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import type { ChecklistStudent } from '@tbd/shared/requirements';
import type { JobPayload } from '@tbd/shared/jobs';
import { buildAccountExport, deleteAccount, disconnectCommonApp, ensureStudentWideItems, recomputeNextActions } from '@tbd/shared/services';
import { localDate } from '@tbd/shared/time';
import type { WorkerDeps } from '../deps';

async function loadChecklistStudent(deps: WorkerDeps, studentId: string): Promise<ChecklistStudent> {
  const sdb = scoped(deps.db, studentId);
  const profile = await sdb.selectOne(S.studentProfiles);
  return {
    testStance: profile?.testScores.test_optional_stance ?? 'undecided',
    hasSatOrAct: Boolean(profile && (profile.testScores.sat.length > 0 || profile.testScores.act.length > 0)),
    financialConstraints: profile?.demographics.financial_constraints ?? null,
    firstGeneration: profile?.demographics.first_generation ?? null,
  };
}

export async function runRecomputeNextActions(deps: WorkerDeps, payload: JobPayload<'maintenance.recompute_next_actions'>) {
  const sdb = scoped(deps.db, payload.studentId);
  const student = await studentsRepo.findById(deps.db, payload.studentId);
  if (!student) throw new AuthorizationError();
  const today = localDate(deps.clock.now(), student.timezone);
  const actions = await recomputeNextActions(sdb, { today, intensity: student.nudgeIntensity });
  await appendAudit(sdb, { actor: 'system', action: 'next_actions.recomputed', details: { reason: payload.reason, count: actions.length } });
  return actions;
}

export async function runDisconnectCommonApp(deps: WorkerDeps, payload: JobPayload<'maintenance.disconnect_commonapp'>) {
  const sdb = scoped(deps.db, payload.studentId);
  await disconnectCommonApp(sdb, deps.enqueuer);
}

export async function runDeleteAccount(deps: WorkerDeps, payload: JobPayload<'maintenance.delete_account'>) {
  const student = await studentsRepo.findById(deps.db, payload.studentId);
  if (student?.phoneE164) {
    await deps.messaging.send({ to: student.phoneE164, body: 'All your data is deleted. Good luck out there.' }).catch((err: unknown) => {
      deps.logger.warn({ studentId: payload.studentId, err: err instanceof Error ? err.message : String(err) }, 'delete_account.farewell_text_failed');
    });
  }
  await deleteAccount(deps.db, payload.studentId, deps.storage);
}

export async function runExportData(deps: WorkerDeps, payload: JobPayload<'maintenance.export_data'>) {
  const sdb = scoped(deps.db, payload.studentId);
  const exportData = await buildAccountExport(sdb);
  const key = `${payload.studentId}/exports/${payload.runId}.json`;
  await deps.storage.put(key, Buffer.from(JSON.stringify(exportData, null, 2), 'utf8'), 'application/json');

  const runRows = await deps.db.select().from(S.agentRuns).where(eq(S.agentRuns.id, payload.runId)).limit(1);
  const existingMetadata = runRows[0]?.metadata ?? {};
  await deps.db
    .update(S.agentRuns)
    .set({ outcome: 'completed', metadata: { ...existingMetadata, export_key: key } })
    .where(eq(S.agentRuns.id, payload.runId));
  await appendAudit(sdb, { actor: 'system', action: 'export.completed', entityType: 'agent_run', entityId: payload.runId, details: { export_key: key } });
  return { exportKey: key };
}

export async function runFirstPlan(deps: WorkerDeps, payload: JobPayload<'maintenance.first_plan'>) {
  const sdb = scoped(deps.db, payload.studentId);
  const student = await studentsRepo.findById(deps.db, payload.studentId);
  if (!student) throw new AuthorizationError();

  const today = localDate(deps.clock.now(), student.timezone);
  const checklistStudent = await loadChecklistStudent(deps, payload.studentId);
  await ensureStudentWideItems(sdb, { today, student: checklistStudent });
  const actions = await recomputeNextActions(sdb, { today, intensity: student.nudgeIntensity });
  const applications = await sdb.select(S.applications);

  if (!student.phoneE164) return { sent: false };
  const top3 = actions.slice(0, 3).map((a) => a.action);
  const text = `Here's where things stand: ${applications.length} school${applications.length === 1 ? '' : 's'}, ${actions.length} open item${actions.length === 1 ? '' : 's'}. Top 3: ${top3.join('; ') || 'nothing open yet'}.`;

  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const sent = await deps.messaging.send({ to: student.phoneE164, body: text });
  const row = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    body: text,
    providerMessageId: sent.providerMessageId,
    deliveryStatus: sent.status,
    proactive: true,
  });
  await nudgesRepo.recordSent(sdb, { kind: 'custom', triggerKey: 'first_plan', messageId: row.id });
  await appendAudit(sdb, { actor: 'system', action: 'first_plan.sent', entityType: 'message', entityId: row.id });
  return { sent: true };
}
