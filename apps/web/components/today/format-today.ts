import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** "Thursday, September 5" — Today's PageTitle meta, from a date-only ISO string in the
 * student's timezone. Long weekday and month, no year (unlike lib/format.ts's short forms). */
export function formatLongDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'EEEE, MMMM d');
}
