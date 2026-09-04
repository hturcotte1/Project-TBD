/**
 * Every `agent.*` job. Most are thin passthroughs onto `@tbd/agent`'s runtime functions (which
 * already load their own context and record their own audit trail); `proactive_run` is the one
 * with real logic here — it turns the scheduler's raw trigger candidates into the nudge policy's
 * plan, phrases and sends what's sendable now, defers the rest, and special-cases the two batch
 * kinds (`morning_plan`, `weekly_plan`) that don't just become a text.
 */
import { asc, eq } from 'drizzle-orm';
import {
  phraseNudges,
  runConversationTurn,
  runDocumentExtraction,
  runEssayFeedback,
  runNarrativeSummary,
  runReminderDraft,
  runSyncFollowup,
  runWeeklyPlan,
  sendProactive,
  sendWelcome,
} from '@tbd/agent';
import { AuthorizationError, nudgesRepo, scoped, studentsRepo } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import type { JobPayload } from '@tbd/shared/jobs';
import { jobIds } from '@tbd/shared/jobs';
import { sendCap } from '@tbd/shared/prioritize';
import { planNudges } from '@tbd/shared/proactive';
import type { TriggerEvent } from '@tbd/shared/schemas';
import { countProactiveSentToday, loadSuppressedItemIds } from '@tbd/shared/services';
import { addDays, localDate, weekStartOf } from '@tbd/shared/time';
import type { WorkerDeps } from '../deps';

async function finalizeRun(deps: WorkerDeps, runId: string, outcome: 'completed' | 'failed', error?: string): Promise<void> {
  await deps.db
    .update(S.agentRuns)
    .set({ outcome, ...(error !== undefined ? { error } : {}) })
    .where(eq(S.agentRuns.id, runId));
}

/** Wraps a runtime call whose `runId` was created by whoever enqueued the job: marks it
 * `completed` on success, `failed` with the error message (then rethrows) on failure. */
async function withRun<T>(deps: WorkerDeps, runId: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    await finalizeRun(deps, runId, 'completed');
    return result;
  } catch (err) {
    await finalizeRun(deps, runId, 'failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function runInboundMessage(deps: WorkerDeps, payload: JobPayload<'agent.inbound_message'>) {
  return runConversationTurn(deps, payload);
}

export async function runSyncFollowupJob(deps: WorkerDeps, payload: JobPayload<'agent.sync_followup'>) {
  return runSyncFollowup(deps, payload);
}

export async function runEssayFeedbackJob(deps: WorkerDeps, payload: JobPayload<'agent.essay_feedback'>) {
  return withRun(deps, payload.runId, () => runEssayFeedback(deps, payload));
}

export async function runDocumentExtractionJob(deps: WorkerDeps, payload: JobPayload<'agent.document_extraction'>) {
  return runDocumentExtraction(deps, payload);
}

export async function runWeeklyPlanJob(deps: WorkerDeps, payload: JobPayload<'agent.weekly_plan'>) {
  return runWeeklyPlan(deps, payload);
}

export async function runReminderDraftJob(deps: WorkerDeps, payload: JobPayload<'agent.reminder_draft'>) {
  return withRun(deps, payload.runId, () => runReminderDraft(deps, payload));
}

export async function runWelcomeJob(deps: WorkerDeps, payload: JobPayload<'agent.welcome'>) {
  return sendWelcome(deps, payload);
}

export async function runNarrativeSummaryJob(deps: WorkerDeps, payload: JobPayload<'agent.narrative_summary'>) {
  return withRun(deps, payload.runId, () => runNarrativeSummary(deps, payload));
}

/** Every trigger in `payload.triggers` that `plan` neither sent nor dropped (cap/suppressed/
 * duplicate) — the ones quiet hours or a snooze held back, and which should be retried at
 * `plan.deferUntil`. */
function deferredTriggers(candidates: TriggerEvent[], plan: ReturnType<typeof planNudges>): TriggerEvent[] {
  const accounted = new Set<string>([...plan.dropped.map((d) => d.trigger.trigger_key), ...plan.batches.flat().map((t) => t.trigger_key)]);
  return candidates.filter((t) => !accounted.has(t.trigger_key));
}

export async function runProactiveRun(deps: WorkerDeps, payload: JobPayload<'agent.proactive_run'>): Promise<{ sent: number }> {
  const sdb = scoped(deps.db, payload.studentId);
  const student = await studentsRepo.findById(deps.db, payload.studentId);
  if (!student) throw new AuthorizationError();
  const now = deps.clock.now();

  const [sentTodayCount, suppressedItemIds] = await Promise.all([
    countProactiveSentToday(sdb, now, student.timezone),
    loadSuppressedItemIds(sdb, now),
  ]);

  const plan = planNudges({
    now,
    timezone: student.timezone,
    quietHours: { start: student.quietHoursStart, end: student.quietHoursEnd },
    intensity: student.nudgeIntensity,
    snoozedUntil: student.snoozedUntil,
    candidates: payload.triggers,
    sentTodayCount,
    suppressedItemIds,
  });

  if (plan.deferUntil) {
    const deferred = deferredTriggers(payload.triggers, plan);
    if (deferred.length > 0) {
      const delayMs = Math.max(0, plan.deferUntil.getTime() - now.getTime());
      await deps.enqueuer.enqueue(
        'agent.proactive_run',
        { studentId: payload.studentId, triggers: deferred, tickAt: payload.tickAt },
        { jobId: jobIds.proactive(payload.studentId, `deferred-${plan.deferUntil.toISOString()}`), delayMs },
      );
    }
  }

  const toPhrase: TriggerEvent[][] = [];
  for (const batch of plan.batches) {
    const single = batch.length === 1 ? batch[0] : undefined;

    if (single?.kind === 'weekly_plan') {
      const weekStart = weekStartOf(addDays(localDate(now, student.timezone), 1));
      await deps.enqueuer.enqueue('agent.weekly_plan', { studentId: payload.studentId, weekStart }, { jobId: jobIds.weekly(payload.studentId, weekStart) });
      await nudgesRepo.recordSent(sdb, { kind: 'weekly_plan', triggerKey: single.trigger_key, sentAt: now });
      continue;
    }

    if (single?.kind === 'morning_plan') {
      const topActions = await sdb.select(S.nextActions, eq(S.nextActions.status, 'open'), { orderBy: asc(S.nextActions.rank), limit: sendCap(student.nudgeIntensity) });
      const topActionsText = topActions.map((a) => `${a.action} — ${a.reason}`).join('; ');
      toPhrase.push([{ ...single, facts: { ...single.facts, top_actions: topActionsText } }]);
      continue;
    }

    toPhrase.push(batch);
  }

  if (toPhrase.length === 0) return { sent: 0 };
  const phrased = await phraseNudges(deps, { studentId: payload.studentId, batches: toPhrase });
  return sendProactive(deps, { studentId: payload.studentId, phrased });
}
