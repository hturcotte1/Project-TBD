/**
 * Loads the DB-backed inputs the proactive engine needs: `TriggerState` for `evaluateTriggers`,
 * how many proactive messages already went out today (for the daily cap), and which
 * `application_item_id`s are currently suppressed (acknowledged/snoozed).
 */
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import * as S from '../db/schema';
import type { StudentDb } from '../db/repos/scoped';
import { browserJobsRepo, nudgesRepo } from '../db/repos/core';
import { OPEN_ITEM_STATUSES } from '../prioritize';
import type { PrioritizeItem } from '../prioritize';
import type { TriggerApplication, TriggerEssay, TriggerRecommender, TriggerState, TriggerStudent } from '../proactive';
import { localDate, localInstant } from '../time/dates';

/** Builds the full `TriggerState` for one student as of `now`. */
export async function loadTriggerState(sdb: StudentDb, student: S.Student, now: Date): Promise<TriggerState> {
  const lastSyncJob = await browserJobsRepo.latest(sdb, 'full_sync');
  const lastSyncAt = lastSyncJob?.status === 'succeeded' ? (lastSyncJob.finishedAt ?? null) : null;

  const triggerStudent: TriggerStudent = {
    id: student.id,
    timezone: student.timezone,
    quietHours: { start: student.quietHoursStart, end: student.quietHoursEnd },
    nudgeIntensity: student.nudgeIntensity,
    snoozedUntil: student.snoozedUntil,
    onboardingCompletedAt: student.onboardingCompletedAt,
    syncPausedReason: student.syncPausedReason,
    lastSyncAt,
  };

  const applications = await sdb.select(S.applications);
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length > 0 ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
  const triggerApplications: TriggerApplication[] = applications.map((a) => ({
    id: a.id,
    schoolName: schoolNameById.get(a.schoolId) ?? '',
    plan: a.plan,
    deadline: a.deadline,
    status: a.status,
  }));
  const applicationNameById = new Map(triggerApplications.map((a) => [a.id, a.schoolName]));

  const openItems = await sdb.select(S.applicationItems, inArray(S.applicationItems.status, [...OPEN_ITEM_STATUSES]));
  const items: PrioritizeItem[] = openItems.map((item) => ({
    id: item.id,
    applicationId: item.applicationId,
    schoolName: item.applicationId ? (applicationNameById.get(item.applicationId) ?? null) : null,
    ruleKey: item.ruleKey,
    kind: item.kind,
    title: item.title,
    status: item.status,
    dueDate: item.dueDate,
    importance: item.importance,
    effort: item.effort,
    dependsOnOthers: item.dependsOnOthers,
    blocking: item.blocking,
    notes: item.notes,
    evidenceText: item.evidence?.text ?? null,
    recommenderId: item.recommenderId ?? null,
    essayId: item.essayId ?? null,
  }));

  const recommenderRows = await sdb.select(S.recommenders);
  const recommenderIds = recommenderRows.map((r) => r.id);
  const assignmentRows = recommenderIds.length > 0 ? await sdb.select(S.recommenderAssignments, inArray(S.recommenderAssignments.recommenderId, recommenderIds)) : [];
  const recommenders: TriggerRecommender[] = recommenderRows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    assignments: assignmentRows
      .filter((a) => a.recommenderId === r.id)
      .map((a) => ({ applicationId: a.applicationId, status: a.status, invitedAt: a.invitedAt })),
  }));

  const essayRows = await sdb.select(S.essays);
  const essayIds = essayRows.map((e) => e.id);
  const draftRows =
    essayIds.length > 0 ? await sdb.select(S.essayDrafts, and(inArray(S.essayDrafts.essayId, essayIds), lte(S.essayDrafts.createdAt, now))) : [];
  const latestDraftByEssay = new Map<string, S.EssayDraft>();
  for (const d of draftRows) {
    const cur = latestDraftByEssay.get(d.essayId);
    if (!cur || d.createdAt > cur.createdAt) latestDraftByEssay.set(d.essayId, d);
  }
  const linkedItemIds = essayRows.map((e) => e.applicationItemId).filter((id): id is string => Boolean(id));
  const linkedItems = linkedItemIds.length > 0 ? await sdb.select(S.applicationItems, inArray(S.applicationItems.id, linkedItemIds)) : [];
  const itemStatusById = new Map(linkedItems.map((i) => [i.id, i.status]));

  const essays: TriggerEssay[] = essayRows.map((e) => {
    const latestDraft = latestDraftByEssay.get(e.id) ?? null;
    return {
      id: e.id,
      applicationId: e.applicationId,
      title: e.title,
      lastEditedAt: latestDraft?.createdAt ?? null,
      wordCount: latestDraft?.wordCount ?? 0,
      wordLimit: e.wordLimit,
      itemStatus: e.applicationItemId ? (itemStatusById.get(e.applicationItemId) ?? null) : null,
    };
  });

  const nudgeRows = await sdb.select(S.nudges, lte(S.nudges.sentAt, now));
  const sentTriggerKeys = new Set(nudgeRows.map((n) => n.triggerKey));

  return { student: triggerStudent, applications: triggerApplications, items, recommenders, essays, sentTriggerKeys };
}

/** How many proactive messages have gone out since local midnight (for the daily send cap). */
export async function countProactiveSentToday(sdb: StudentDb, now: Date, timezone: string): Promise<number> {
  const midnight = localInstant(localDate(now, timezone), '00:00', timezone);
  return sdb.count(S.messages, and(eq(S.messages.proactive, true), gte(S.messages.createdAt, midnight)));
}

/** `application_item_id`s currently suppressed (acknowledged, or snoozed into the future). */
export async function loadSuppressedItemIds(sdb: StudentDb, now: Date): Promise<Set<string>> {
  return nudgesRepo.suppressedItemIds(sdb, now);
}
