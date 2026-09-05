/**
 * Admin routes: the one route group (besides auth/ and webhooks/) allowed to query across
 * students. Every handler here uses `deps.db` directly, never a single student's `sdb`.
 */
import { Queue } from 'bullmq';
import { desc, eq, gt, inArray, ne } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { AuthorizationError, browserJobsRepo, scoped } from '@apogee/shared/db';
import type * as D from '@apogee/shared/api';
import { QUEUES, jobIds, type QueueName } from '@apogee/shared/jobs';
import { estimateLlmCostUsd, mapAdminStudent, mapBrowserJob, mapDriftAlert, mapQueueHealth } from '../mappers';
import type { AdminStudentAggregate } from '../mappers';
import type { ApiDeps } from '../deps';
import { authed, type Handlers } from './contract';

const OPEN_ITEM_STATUSES: S.ApplicationItem['status'][] = ['missing', 'in_progress', 'blocked'];

async function buildAggregate(deps: ApiDeps, student: S.Student, since24: Date, since30: Date): Promise<AdminStudentAggregate> {
  const sdb = scoped(deps.db, student.id);
  const [applications, openItems, lastSyncJob, lastAnyJob, jobs30, runs30] = await Promise.all([
    sdb.select(S.applications),
    sdb.select(S.applicationItems, inArray(S.applicationItems.status, OPEN_ITEM_STATUSES)),
    browserJobsRepo.latest(sdb, 'full_sync'),
    browserJobsRepo.latest(sdb),
    sdb.select(S.browserJobs, gt(S.browserJobs.createdAt, since30)),
    sdb.select(S.agentRuns, gt(S.agentRuns.createdAt, since30)),
  ]);

  const failedJobs24h = jobs30.filter((j) => j.status === 'failed' && j.createdAt > since24).length;
  const browserMinutes30d = jobs30.reduce((sum, j) => {
    if (j.startedAt && j.finishedAt) return sum + (j.finishedAt.getTime() - j.startedAt.getTime()) / 60_000;
    return sum;
  }, 0);
  const tokensInput30d = runs30.reduce((sum, r) => sum + r.inputTokens, 0);
  const tokensOutput30d = runs30.reduce((sum, r) => sum + r.outputTokens, 0);

  return {
    student,
    applicationsCount: applications.length,
    openItems: openItems.length,
    lastSyncedAt: lastSyncJob?.finishedAt ?? null,
    lastJobStatus: lastAnyJob?.status ?? null,
    failedJobs24h,
    tokensInput30d,
    tokensOutput30d,
    browserMinutes30d: Math.round(browserMinutes30d * 10) / 10,
  };
}

export const adminHandlers: Pick<Handlers, 'adminStudents' | 'adminQueues' | 'adminJobs' | 'adminDrift' | 'adminDriftResolve' | 'adminSyncNow' | 'adminCosts'> = {
  adminStudents: authed(async ({ deps }) => {
    const students = await deps.db.select().from(S.students).where(ne(S.students.status, 'deleted'));
    const now = deps.clock.now();
    const since24 = new Date(now.getTime() - 24 * 3600 * 1000);
    const since30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const aggregates = await Promise.all(students.map((s) => buildAggregate(deps, s, since24, since30)));
    return aggregates.map(mapAdminStudent);
  }),

  adminQueues: authed(async ({ deps }) => {
    const names = Object.values(QUEUES) as QueueName[];
    if (!deps.redis) return names.map((n) => mapQueueHealth(n, {}));
    const counts = await Promise.all(
      names.map(async (name) => {
        const queue = new Queue(name, { connection: deps.redis! });
        const c = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        return mapQueueHealth(name, c);
      }),
    );
    return counts;
  }),

  adminJobs: authed(async ({ deps, query }) => {
    const rows = await deps.db
      .select()
      .from(S.browserJobs)
      .where(query.status ? eq(S.browserJobs.status, query.status) : undefined)
      .orderBy(desc(S.browserJobs.createdAt))
      .limit(query.limit);
    return Promise.all(rows.map((r) => mapBrowserJob(r, deps.storage)));
  }),

  adminDrift: authed(async ({ deps }) => {
    const rows = await deps.db.select().from(S.siteDriftAlerts).orderBy(desc(S.siteDriftAlerts.createdAt));
    return rows.map(mapDriftAlert);
  }),

  adminDriftResolve: authed(async ({ deps, params, body }) => {
    const [row] = await deps.db
      .update(S.siteDriftAlerts)
      .set({ status: body.status, resolvedAt: body.status === 'resolved' ? deps.clock.now() : null })
      .where(eq(S.siteDriftAlerts.id, params.id))
      .returning();
    if (!row) throw new AuthorizationError();
    return mapDriftAlert(row);
  }),

  adminSyncNow: authed(async ({ deps, params }) => {
    const sdb = scoped(deps.db, params.id);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: deps.env.BROWSER_PROVIDER });
    await deps.enqueuer.enqueue(
      'browser.full_sync',
      { studentId: params.id, browserJobId: job.id, reason: 'admin' },
      { jobId: jobIds.sync(params.id, `admin-${job.id}`) },
    );
    return mapBrowserJob(job, deps.storage);
  }),

  adminCosts: authed(async ({ deps }) => {
    const students = await deps.db.select().from(S.students).where(ne(S.students.status, 'deleted'));
    const now = deps.clock.now();
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const entries: D.CostReportDto['students'] = [];
    for (const student of students) {
      const sdb = scoped(deps.db, student.id);
      const [runs, jobs] = await Promise.all([sdb.select(S.agentRuns, gt(S.agentRuns.createdAt, since)), sdb.select(S.browserJobs, gt(S.browserJobs.createdAt, since))]);
      const inputTokens = runs.reduce((sum, r) => sum + r.inputTokens, 0);
      const outputTokens = runs.reduce((sum, r) => sum + r.outputTokens, 0);
      const estimatedUsd = runs.reduce((sum, r) => sum + estimateLlmCostUsd(r.model, r.inputTokens, r.outputTokens), 0);
      const browserMinutes = jobs.reduce((sum, j) => (j.startedAt && j.finishedAt ? sum + (j.finishedAt.getTime() - j.startedAt.getTime()) / 60_000 : sum), 0);
      entries.push({
        student_id: student.id,
        name: [student.preferredName || student.firstName, student.lastName].filter(Boolean).join(' ').trim() || student.email,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_llm_usd: Math.round(estimatedUsd * 10_000) / 10_000,
        browser_minutes: Math.round(browserMinutes * 10) / 10,
        runs: runs.length,
        jobs: jobs.length,
      });
    }
    return { students: entries, since: since.toISOString() };
  }),
};
