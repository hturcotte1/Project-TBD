import * as S from '@tbd/shared/db/schema';
import * as D from '@tbd/shared/api';
import { applicationCommonAppUrl } from '@tbd/shared/requirements';
import { daysUntil } from '@tbd/shared/time';
import { mapSchool } from './school';

export function mapApplicationItem(row: S.ApplicationItem): D.ApplicationItemDto {
  return {
    id: row.id,
    application_id: row.applicationId,
    rule_key: row.ruleKey,
    kind: row.kind,
    title: row.title,
    description: row.description,
    source: row.source,
    status: row.status,
    evidence: row.evidence ?? null,
    due_date: row.dueDate,
    importance: row.importance,
    effort: row.effort,
    depends_on_others: row.dependsOnOthers,
    blocking: row.blocking,
    student_edited: row.studentEdited,
    notes: row.notes,
    essay_id: row.essayId,
    recommender_id: row.recommenderId,
    last_checked_at: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    updated_at: row.updatedAt.toISOString(),
  };
}

export function computeItemCounts(items: S.ApplicationItem[]): D.ItemCountsDto {
  const counts: D.ItemCountsDto = { total: items.length, done: 0, missing: 0, in_progress: 0, blocked: 0, not_applicable: 0 };
  for (const item of items) {
    switch (item.status) {
      case 'done':
        counts.done++;
        break;
      case 'missing':
        counts.missing++;
        break;
      case 'in_progress':
        counts.in_progress++;
        break;
      case 'blocked':
        counts.blocked++;
        break;
      case 'not_applicable':
        counts.not_applicable++;
        break;
    }
  }
  return counts;
}

export function completionPercent(counts: D.ItemCountsDto): number {
  const applicable = counts.total - counts.not_applicable;
  if (applicable <= 0) return 0;
  return Math.round((counts.done / applicable) * 1000) / 10;
}

export interface MapApplicationOpts {
  now: Date;
  timezone: string;
  commonAppBaseUrl: string;
}

export function mapApplication(row: S.Application, school: S.School, items: S.ApplicationItem[], opts: MapApplicationOpts): D.ApplicationDto {
  const counts = computeItemCounts(items);
  return {
    id: row.id,
    school: mapSchool(school),
    plan: row.plan,
    deadline: row.deadline,
    deadline_source: row.deadlineSource,
    days_remaining: daysUntil(row.deadline, opts.now, opts.timezone),
    status: row.status,
    decision: row.decision,
    self_assessment: row.selfAssessment,
    submitted_at: row.submittedAt ? row.submittedAt.toISOString() : null,
    last_synced_at: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    notes: row.notes,
    counts,
    completion_percent: completionPercent(counts),
    common_app_url: school.commonAppMember ? applicationCommonAppUrl(opts.commonAppBaseUrl, school.slug) : null,
  };
}

export function mapApplicationDetail(
  row: S.Application,
  school: S.School,
  items: S.ApplicationItem[],
  requirements: S.SchoolRequirementsRow | null,
  opts: MapApplicationOpts,
): D.ApplicationDetailDto {
  return {
    ...mapApplication(row, school, items, opts),
    items: items.map(mapApplicationItem),
    requirements: requirements?.data ?? null,
  };
}
