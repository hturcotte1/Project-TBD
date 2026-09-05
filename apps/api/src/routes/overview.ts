import { desc, gt, inArray } from 'drizzle-orm';
import * as S from '@apogee/shared/db/schema';
import { approvalsRepo, AuthorizationError, browserJobsRepo, studentsRepo } from '@apogee/shared/db';
import type * as D from '@apogee/shared/api';
import { daysUntil, localDate } from '@apogee/shared/time';
import { authed, type Handlers } from './contract';

const CLOSED_APPLICATION_STATUSES = new Set<S.Application['status']>(['submitted', 'decision_received']);

export const overviewHandlers: Pick<Handlers, 'overview'> = {
  overview: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const now = deps.clock.now();
    const today = localDate(now, student.timezone);

    const [applications, items] = await Promise.all([sdb.select(S.applications), sdb.select(S.applicationItems)]);
    const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
    const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
    const schoolById = new Map(schools.map((s) => [s.id, s]));

    let nearest: D.OverviewDto['nearest_deadline'] = null;
    for (const a of applications) {
      if (CLOSED_APPLICATION_STATUSES.has(a.status)) continue;
      const days = daysUntil(a.deadline, now, student.timezone);
      if (!nearest || days < nearest.days_remaining) {
        const school = schoolById.get(a.schoolId);
        nearest = { school_name: school?.name ?? '', plan: a.plan, date: a.deadline, days_remaining: days };
      }
    }

    const itemsOpen = items.filter((i) => i.status === 'missing' || i.status === 'in_progress' || i.status === 'blocked').length;
    const itemsDone = items.filter((i) => i.status === 'done').length;

    const since = new Date(now.getTime() - 24 * 3600 * 1000);
    const recentSnapshots = await sdb.select(S.commonAppSnapshots, gt(S.commonAppSnapshots.createdAt, since));
    const changesSinceYesterday = recentSnapshots.flatMap((s) => s.diff);

    const lastSyncJob = await browserJobsRepo.latest(sdb, 'full_sync');
    const pendingApprovals = await approvalsRepo.pending(sdb);

    const weeklyRows = await sdb.select(S.weeklyPlans, undefined, { orderBy: desc(S.weeklyPlans.weekStart), limit: 1 });

    return {
      today,
      nearest_deadline: nearest,
      applications_count: applications.length,
      items_open: itemsOpen,
      items_done: itemsDone,
      changes_since_yesterday: changesSinceYesterday,
      last_synced_at: lastSyncJob?.finishedAt ? lastSyncJob.finishedAt.toISOString() : null,
      sync_paused_reason: student.syncPausedReason,
      pending_approvals: pendingApprovals.length,
      weekly_plan: weeklyRows[0]?.plan ?? null,
    };
  }),
};
