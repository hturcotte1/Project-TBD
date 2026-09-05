/** `browser.full_sync`: logs in, captures every page, diffs against the previous snapshot,
 * reconciles the checklist through `applySnapshot`, flags low-confidence sections as site drift,
 * and follows up with the agent when anything worth telling the student changed. On three
 * consecutive failures it pauses syncing for the student and texts them once. */
import { and, desc, eq } from 'drizzle-orm';
import { diffSnapshots } from '@apogee/browser';
import { appendAudit, browserJobsRepo, conversationsRepo, messagesRepo, nudgesRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { jobIds, type JobPayload } from '@apogee/shared/jobs';
import { BrowserJobResult } from '@apogee/shared/schemas';
import { applySnapshot } from '@apogee/shared/services';
import { isQuietNow, localDate, nextQuietHoursEnd } from '@apogee/shared/time';
import type { WorkerDeps } from '../../deps';
import { runBrowserJob } from './lifecycle';
import { loginForJob } from './login';

const CONSECUTIVE_FAILURES_BEFORE_PAUSE = 3;

function averageConfidence(confidence: Record<string, number>): number {
  const values = Object.values(confidence);
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function recordDriftAlerts(deps: WorkerDeps, browserJobId: string, sections: string[], confidence: Record<string, number>): Promise<void> {
  for (const section of sections) {
    const existing = await deps.db
      .select({ id: S.siteDriftAlerts.id })
      .from(S.siteDriftAlerts)
      .where(and(eq(S.siteDriftAlerts.section, section), eq(S.siteDriftAlerts.status, 'open')))
      .limit(1);
    if (existing.length > 0) continue;
    await deps.db.insert(S.siteDriftAlerts).values({
      section,
      confidence: (confidence[section] ?? 0).toFixed(3),
      browserJobId,
      details: {},
      status: 'open',
    });
  }
}

async function handleRepeatedFailure(deps: WorkerDeps, studentId: string): Promise<void> {
  const sdb = scoped(deps.db, studentId);
  const failures = await browserJobsRepo.recentConsecutiveFailures(sdb, 'full_sync');
  if (failures < CONSECUTIVE_FAILURES_BEFORE_PAUSE) return;

  await deps.db.update(S.students).set({ syncPausedReason: 'browser_failures' }).where(eq(S.students.id, studentId));
  await browserJobsRepo.cancelQueued(sdb);
  await deps.enqueuer.cancelByPrefix('browser', jobIds.browserPrefix(studentId));

  const student = await studentsRepo.findById(deps.db, studentId);
  if (!student?.phoneE164) return;
  const today = localDate(deps.clock.now(), student.timezone);
  const nudgeKey = `sync_paused:${today}`;
  if (await nudgesRepo.wasSent(sdb, nudgeKey)) return;

  const text = `I couldn't get into your Common App — did your password change? Reconnect here: ${deps.env.APP_URL}/settings`;
  const now = deps.clock.now();
  const quiet = { start: student.quietHoursStart, end: student.quietHoursEnd };
  if (isQuietNow(now, student.timezone, quiet)) {
    // Not an emergency: hold the text until quiet hours end, through the normal proactive path.
    const deliverAt = nextQuietHoursEnd(now, student.timezone, quiet);
    await deps.enqueuer.enqueue(
      'agent.proactive_run',
      {
        studentId,
        tickAt: now.toISOString(),
        triggers: [
          {
            kind: 'custom',
            trigger_key: nudgeKey,
            application_id: null,
            application_item_id: null,
            recommender_id: null,
            essay_id: null,
            due_date: null,
            days_remaining: null,
            facts: { message: text },
            always_send: false,
            priority: 80,
          },
        ],
      },
      { jobId: jobIds.proactive(studentId, `sync-paused-${today}`), delayMs: Math.max(0, deliverAt.getTime() - now.getTime()) },
    );
    await appendAudit(sdb, { actor: 'system', action: 'sync.paused', entityType: 'student', entityId: studentId, details: { failures, deferredUntil: deliverAt.toISOString() } });
    return;
  }
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const sent = await deps.messaging.send({ to: student.phoneE164, body: text });
  const row = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    body: text,
    providerMessageId: sent.providerMessageId,
    deliveryStatus: sent.status,
  });
  await nudgesRepo.recordSent(sdb, { kind: 'sync_change', triggerKey: nudgeKey, messageId: row.id });
  await appendAudit(sdb, { actor: 'system', action: 'sync.paused', entityType: 'student', entityId: studentId, details: { failures } });
}

export async function runFullSync(deps: WorkerDeps, payload: JobPayload<'browser.full_sync'>): Promise<BrowserJobResult> {
  try {
    return await runBrowserJob(deps, { browserJobId: payload.browserJobId, studentId: payload.studentId, kind: 'full_sync' }, async (session, hooks) => {
      const login = await loginForJob(deps, session, payload.studentId, payload.browserJobId);
      const capture = await deps.browser.captureSnapshot(session, hooks);

      const sdb = scoped(deps.db, payload.studentId);
      const student = await studentsRepo.findById(deps.db, payload.studentId);
      const timezone = student?.timezone ?? 'America/New_York';
      const today = localDate(deps.clock.now(), timezone);

      const previousRows = await sdb.select(S.commonAppSnapshots, undefined, { orderBy: desc(S.commonAppSnapshots.createdAt), limit: 1 });
      const previousNormalized = previousRows[0]?.normalized ?? null;
      const changes = diffSnapshots(previousNormalized, capture.normalized);

      const applied = await deps.db.transaction(async (tx) => {
        const txSdb = scoped(tx, payload.studentId);
        return applySnapshot(tx, txSdb, {
          snapshot: capture.normalized,
          raw: capture.raw,
          diff: changes,
          browserJobId: payload.browserJobId,
          today,
          capturedAt: capture.normalized.captured_at,
          overallConfidence: averageConfidence(capture.normalized.confidence),
        });
      });

      const hasNoteworthyChange = changes.some((c) => c.significance === 'important' || c.significance === 'notable');
      if (hasNoteworthyChange) {
        await deps.enqueuer.enqueue(
          'agent.sync_followup',
          { studentId: payload.studentId, snapshotId: applied.snapshotId, browserJobId: payload.browserJobId },
          { jobId: jobIds.syncFollowup(applied.snapshotId) },
        );
      }

      await recordDriftAlerts(deps, payload.browserJobId, capture.normalized.low_confidence_sections, capture.normalized.confidence);

      return BrowserJobResult.parse({
        pages_visited: capture.pagesVisited,
        snapshot_id: applied.snapshotId,
        changes_count: changes.length,
        verification_requested: login.verificationRequested,
        login_ok: true,
        low_confidence_sections: capture.normalized.low_confidence_sections,
        notes: `Full sync completed; ${changes.length} change(s), ${applied.itemsInserted} item(s) added, ${applied.itemsUpdated} updated.`,
      });
    });
  } catch (err) {
    await handleRepeatedFailure(deps, payload.studentId);
    throw err;
  }
}
