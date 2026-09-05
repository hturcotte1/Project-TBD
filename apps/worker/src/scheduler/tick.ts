/**
 * `scheduler.tick`: runs every 5 minutes (see `src/index.ts`'s repeatable job). For every active,
 * onboarded student it decides whether a sync is due (`shouldSync`), evaluates the deterministic
 * proactive trigger rules (`evaluateTriggers`), and expires stale approvals. Every enqueue uses a
 * deterministic job id so re-ticking (or a retried tick) never double-enqueues.
 *
 * This file legitimately enumerates every student — it is allow-listed in the authorization scan
 * (see `packages/shared/src/testing/authz-scan.test.ts`), same as `src/jobs/maintenance.ts`.
 */
import { inArray } from 'drizzle-orm';
import { approvalsRepo, browserJobsRepo, credentialsRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import type { ApplicationStatus } from '@apogee/shared/domain';
import { jobIds } from '@apogee/shared/jobs';
import { evaluateTriggers, shouldSync } from '@apogee/shared/proactive';
import { loadTriggerState } from '@apogee/shared/services';
import { daysUntil } from '@apogee/shared/time';
import type { WorkerDeps } from '../deps';

const OPEN_APPLICATION_STATUSES = new Set<ApplicationStatus>(['not_started', 'in_progress', 'ready_to_submit']);
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function floorToFiveMinutes(date: Date): Date {
  return new Date(Math.floor(date.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS);
}

export interface TickSummary {
  students: number;
  syncsEnqueued: number;
  proactiveEnqueued: number;
}

export async function runTick(deps: WorkerDeps, now: Date = deps.clock.now()): Promise<TickSummary> {
  const students = await studentsRepo.listActive(deps.db);
  const onboarded = students.filter((s) => s.onboardingCompletedAt !== null);

  let syncsEnqueued = 0;
  let proactiveEnqueued = 0;

  for (const student of onboarded) {
    const sdb = scoped(deps.db, student.id);
    const state = await loadTriggerState(sdb, student, now);

    // ---- (a) sync ----
    let nearestDeadlineDays: number | null = null;
    for (const app of state.applications) {
      if (!OPEN_APPLICATION_STATUSES.has(app.status)) continue;
      const d = daysUntil(app.deadline, now, student.timezone);
      if (nearestDeadlineDays === null || d < nearestDeadlineDays) nearestDeadlineDays = d;
    }
    const decision = shouldSync(state.student, now, nearestDeadlineDays);
    if (decision.due) {
      const credentialStatus = await credentialsRepo.status(sdb, 'common_app');
      const activeJob = await sdb.selectOne(S.browserJobs, inArray(S.browserJobs.status, ['queued', 'running', 'awaiting_verification_code']));
      if (credentialStatus?.status === 'active' && !activeJob) {
        const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: deps.sessions.provider });
        await deps.enqueuer.enqueue(
          'browser.full_sync',
          { studentId: student.id, browserJobId: job.id, reason: 'scheduled' },
          { jobId: jobIds.sync(student.id, decision.bucket) },
        );
        syncsEnqueued++;
      }
    }

    // ---- (b) proactive ----
    const events = evaluateTriggers(state, now);
    if (events.length > 0) {
      const bucket = floorToFiveMinutes(now).toISOString();
      await deps.enqueuer.enqueue(
        'agent.proactive_run',
        { studentId: student.id, triggers: events, tickAt: now.toISOString() },
        { jobId: jobIds.proactive(student.id, bucket) },
      );
      proactiveEnqueued++;
    }

    // ---- (c) expire stale approvals ----
    await approvalsRepo.expireStale(sdb);
  }

  return { students: onboarded.length, syncsEnqueued, proactiveEnqueued };
}
