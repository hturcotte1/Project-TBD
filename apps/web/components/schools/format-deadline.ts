import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * "Nov 1" — the compact deadline date used in the Schools table and the school header's countdown
 * label. `lib/format.ts`'s `formatDate` includes the weekday ("Sun, Nov 1"), which reads well in a
 * sentence on its own but crowds a spot that already carries the day count or a plan name right
 * next to it.
 */
export function formatDeadlineDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'MMM d');
}
