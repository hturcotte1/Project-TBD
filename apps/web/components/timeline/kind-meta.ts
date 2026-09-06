import type { TimelineEntryDto } from '@apogee/shared/api';
import type { ItemStatus } from '@apogee/shared/domain';
import type { SegmentedOption } from '@/components/system';

export type TimelineKind = TimelineEntryDto['kind'];

export const TIMELINE_KINDS: TimelineKind[] = ['application_deadline', 'item_due', 'aid_deadline', 'custom'];

/** The Segmented filter's value: a kind, or 'all'. Stored verbatim in the URL's `?kind=`. */
export type TimelineKindFilter = TimelineKind | 'all';

export const KIND_FILTER_OPTIONS: SegmentedOption[] = [
  { value: 'all', label: 'All' },
  { value: 'application_deadline', label: 'Deadlines' },
  { value: 'item_due', label: 'Items' },
  { value: 'aid_deadline', label: 'Aid' },
  { value: 'custom', label: 'Custom' },
];

export function isTimelineKind(value: string): value is TimelineKind {
  return (TIMELINE_KINDS as string[]).includes(value);
}

/** The agenda's kind word, singular ("Deadline", not "Deadlines" — this reads inline in a row,
 * the filter's own plural labels are for KIND_FILTER_OPTIONS above). */
export const KIND_WORD_LABELS: Record<TimelineKind, string> = {
  application_deadline: 'Deadline',
  item_due: 'Item',
  aid_deadline: 'Aid',
  custom: 'Custom',
};

/** A small per-kind marker class, kept for any consumer that still wants a dot (none in this
 * area's own UI — the agenda uses the kind word column instead). Tokens only, and deliberately not
 * heat: DESIGN.md reserves heat for urgency, never for category. */
export const TIMELINE_KIND_DOT_CLASS: Record<TimelineKind, string> = {
  application_deadline: 'bg-fg',
  item_due: 'bg-fg-2',
  aid_deadline: 'bg-fg-3',
  custom: 'bg-line-strong',
};

export interface TimelineStatusInfo {
  text: string;
  tone: 'ok' | 'muted';
}

/** The agenda's status word — only for the three statuses DESIGN.md gives a word to. `missing` and
 * `not_applicable` render nothing (an application without one yet isn't "in progress"). */
const STATUS_LABELS: Partial<Record<ItemStatus, TimelineStatusInfo>> = {
  done: { text: 'Done', tone: 'ok' },
  in_progress: { text: 'In progress', tone: 'muted' },
  blocked: { text: 'Blocked', tone: 'muted' },
};

export function timelineStatusInfo(status: ItemStatus | null): TimelineStatusInfo | null {
  return status ? (STATUS_LABELS[status] ?? null) : null;
}
