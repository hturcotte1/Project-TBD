import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * "Nov 1" — a due date with no weekday, resolved in the student's zone. `lib/format.ts` only
 * exports date formats that include the weekday (`formatDate`), and it's shared across every
 * page's area, so this compact variant lives here instead of adding a case to a file other agents
 * are also editing.
 */
export function formatDueDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'MMM d');
}

/** The draft's origin, in plain words, when it's worth calling out (i.e. not the student's own
 * typing). Every draft today comes from `dashboard_editor`, so this returns null in practice, but
 * the source is a free-text field the API leaves room to widen later (an imported draft, say). */
export function formatDraftSource(source: string): string | null {
  if (source === 'dashboard_editor') return null;
  return source.replace(/_/g, ' ');
}
