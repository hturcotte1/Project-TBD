import type { TimelineEntryDto } from '@apogee/shared/api';

export type TimelineKind = TimelineEntryDto['kind'];

export const TIMELINE_KINDS: TimelineKind[] = ['application_deadline', 'item_due', 'aid_deadline', 'custom'];

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  application_deadline: 'Application deadlines',
  item_due: 'Item due dates',
  aid_deadline: 'Financial aid',
  custom: 'Custom',
};

/** Tailwind class for a small dot/marker, shared by the calendar and the filter chips. */
export const TIMELINE_KIND_DOT_CLASS: Record<TimelineKind, string> = {
  application_deadline: 'bg-primary',
  item_due: 'bg-warn',
  aid_deadline: 'bg-success',
  custom: 'bg-muted-foreground',
};
