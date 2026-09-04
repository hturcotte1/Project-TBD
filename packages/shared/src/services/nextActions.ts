/**
 * Recomputes `next_actions` for a student: scores every open checklist item with the prioritizer
 * and replaces the stored rows, without resurrecting a next action the student already marked
 * done, snoozed, or dismissed.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import * as S from '../db/schema';
import type { StudentDb } from '../db/repos/scoped';
import type { NudgeIntensity } from '../domain/enums';
import { computeNextActions } from '../prioritize';
import type { PrioritizeApplication, PrioritizeItem } from '../prioritize';
import type { IsoDate } from '../schemas/common';

export interface RecomputeNextActionsOptions {
  today: IsoDate;
  intensity: NudgeIntensity;
  computedByRunId?: string | null;
}

/** Recomputes and replaces the student's `next_actions` rows; returns the fresh ordered open list. */
export async function recomputeNextActions(sdb: StudentDb, opts: RecomputeNextActionsOptions): Promise<S.NextAction[]> {
  const [items, applications, existing] = await Promise.all([sdb.select(S.applicationItems), sdb.select(S.applications), sdb.select(S.nextActions)]);

  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));

  const prioritizeApplications: PrioritizeApplication[] = applications.map((a) => ({
    id: a.id,
    schoolName: schoolNameById.get(a.schoolId) ?? '',
    plan: a.plan,
    deadline: a.deadline,
    status: a.status,
  }));

  const prioritizeItems: PrioritizeItem[] = items.map((item) => ({
    id: item.id,
    applicationId: item.applicationId,
    schoolName: null,
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
  }));

  const specs = computeNextActions({ today: opts.today, items: prioritizeItems, applications: prioritizeApplications, nudgeIntensity: opts.intensity });
  const specByItem = new Map(specs.map((s) => [s.applicationItemId, s]));
  const existingByItem = new Map(existing.filter((r) => r.applicationItemId).map((r) => [r.applicationItemId as string, r]));

  for (const spec of specs) {
    const row = existingByItem.get(spec.applicationItemId);
    // A next action the student already resolved (done/snoozed/dismissed) is never overwritten
    // back to open by a recompute.
    if (row && row.status !== 'open') continue;
    const set = {
      applicationId: spec.applicationId,
      action: spec.action,
      reason: spec.reason,
      priorityScore: spec.priorityScore.toFixed(3),
      rank: spec.rank,
      dueDate: spec.dueDate,
      status: 'open' as const,
      computedByRunId: opts.computedByRunId ?? null,
    };
    if (row) {
      await sdb.update(S.nextActions, set, eq(S.nextActions.id, row.id));
    } else {
      await sdb.insert(S.nextActions, { applicationItemId: spec.applicationItemId, ...set });
    }
  }

  for (const row of existing) {
    if (row.status === 'open' && row.applicationItemId && !specByItem.has(row.applicationItemId)) {
      await sdb.delete(S.nextActions, eq(S.nextActions.id, row.id));
    }
  }

  return sdb.select(S.nextActions, eq(S.nextActions.status, 'open'), { orderBy: asc(S.nextActions.rank) });
}
