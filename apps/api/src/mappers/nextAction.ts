import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';
import { daysUntil } from '@apogee/shared/time';

export function mapNextAction(row: S.NextAction, schoolName: string | null, now: Date, timezone: string): D.NextActionDto {
  return {
    id: row.id,
    application_item_id: row.applicationItemId,
    application_id: row.applicationId,
    school_name: schoolName,
    action: row.action,
    reason: row.reason,
    priority_score: Number(row.priorityScore),
    rank: row.rank,
    due_date: row.dueDate,
    days_remaining: row.dueDate ? daysUntil(row.dueDate, now, timezone) : null,
    status: row.status,
    snoozed_until: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
    updated_at: row.updatedAt.toISOString(),
  };
}
