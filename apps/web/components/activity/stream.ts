/**
 * The Activity page renders one merged stream: every `activityFeed` entry (the audit log) plus
 * one row per change carried by `snapshotsList` (so a sync's individual findings — "Michigan added
 * an optional interview" — show up as their own rows, not buried in one "Synced with Common App"
 * line). Everything here is pure so the filter classification and day-grouping can be unit tested
 * without a network or a clock.
 */
import type { AuditEntryDto, SnapshotSummaryDto } from '@apogee/shared/api';
import type { AuditActor } from '@apogee/shared/domain';
import { formatInTimeZone } from 'date-fns-tz';

export type StreamFilter = 'all' | 'syncs' | 'vector' | 'changes' | 'you';

export const STREAM_FILTER_OPTIONS: { value: StreamFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'syncs', label: 'Syncs' },
  { value: 'vector', label: 'Vector' },
  { value: 'changes', label: 'Changes' },
  { value: 'you', label: 'You' },
];

export function isStreamFilter(value: string): value is StreamFilter {
  return STREAM_FILTER_OPTIONS.some((option) => option.value === value);
}

export interface StreamEntryItem {
  kind: 'entry';
  id: string;
  created_at: string;
  actor: AuditActor;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  replay_url: string | null;
}

export interface StreamChangeItem {
  kind: 'change';
  id: string;
  created_at: string;
  schoolName: string | null;
  summary: string;
}

export type StreamItem = StreamEntryItem | StreamChangeItem;

/** `AuditEntryDto` rows plus one row per `SnapshotSummaryDto.changes` entry, newest first. */
export function toStreamItems(entries: AuditEntryDto[], snapshots: SnapshotSummaryDto[]): StreamItem[] {
  const entryItems: StreamItem[] = entries.map((entry) => ({
    kind: 'entry',
    id: entry.id,
    created_at: entry.created_at,
    actor: entry.actor,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    details: entry.details,
    replay_url: entry.replay_url,
  }));
  const changeItems: StreamItem[] = snapshots.flatMap((snapshot) =>
    snapshot.changes.map((change, index) => ({
      kind: 'change' as const,
      id: `${snapshot.id}:${index}`,
      created_at: snapshot.created_at,
      schoolName: change.school_name,
      summary: change.summary,
    })),
  );
  return [...entryItems, ...changeItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

const SYNC_ACTION_PREFIXES = ['sync.', 'credentials.', 'verification_code.', 'drift.'];
const VECTOR_ACTIONS = new Set(['message.sent', 'approval.created', 'recommender.reminder_drafted', 'essay.feedback_requested', 'narrative.summarized']);

/** A `sync.completed` entry's `details` can carry its change count under either a camelCase or
 * snake_case key (real jobs and the seed script don't agree) — accept both, plus a raw `changes`
 * array if a future writer ever includes one directly. */
function entryCarriesChanges(details: Record<string, unknown>): boolean {
  const changes = details.changes;
  if (Array.isArray(changes)) return changes.length > 0;
  const count = details.changesCount ?? details.changes_count;
  return typeof count === 'number' && count > 0;
}

/** Whether one stream item belongs to a given filter. `filter: 'all'` always matches. */
export function matchesStreamFilter(item: StreamItem, filter: StreamFilter): boolean {
  if (filter === 'all') return true;
  if (item.kind === 'change') return filter === 'changes';
  switch (filter) {
    case 'syncs':
      return SYNC_ACTION_PREFIXES.some((prefix) => item.action.startsWith(prefix));
    case 'vector':
      return item.actor === 'agent' || item.action.startsWith('fill.') || VECTOR_ACTIONS.has(item.action);
    case 'changes':
      return item.action === 'sync.completed' && entryCarriesChanges(item.details);
    case 'you':
      return item.actor === 'student';
    default:
      return true;
  }
}

export function filterStream(items: StreamItem[], filter: StreamFilter): StreamItem[] {
  return items.filter((item) => matchesStreamFilter(item, filter));
}

/** "yyyy-MM-dd" in the student's timezone — the grouping key for a day divider. */
export function dayKey(dateTimeIso: string, timezone: string): string {
  return formatInTimeZone(new Date(dateTimeIso), timezone, 'yyyy-MM-dd');
}

/** "Thursday, September 5" — the day-divider label. */
export function dayDividerLabel(dateTimeIso: string, timezone: string): string {
  return formatInTimeZone(new Date(dateTimeIso), timezone, 'EEEE, MMMM d');
}

/** "3:45 PM" for a row from today, "Sep 3" otherwise — both resolved in the student's timezone. */
export function rowTimeLabel(dateTimeIso: string, timezone: string, now: Date = new Date()): string {
  if (dayKey(dateTimeIso, timezone) === dayKey(now.toISOString(), timezone)) {
    return formatInTimeZone(new Date(dateTimeIso), timezone, 'h:mm a');
  }
  return formatInTimeZone(new Date(dateTimeIso), timezone, 'MMM d');
}

export interface DayGroup<T> {
  dateKey: string;
  label: string;
  items: T[];
}

/**
 * Buckets an already newest-first list into day groups, inserting a new bucket only when the
 * calendar day (in `timezone`) actually changes from the previous item — so a filtered list never
 * shows an empty divider for a day that has nothing left after filtering.
 */
export function groupByDay<T>(items: T[], getCreatedAt: (item: T) => string, timezone: string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const createdAt = getCreatedAt(item);
    const key = dayKey(createdAt, timezone);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === key) {
      last.items.push(item);
    } else {
      groups.push({ dateKey: key, label: dayDividerLabel(createdAt, timezone), items: [item] });
    }
  }
  return groups;
}
