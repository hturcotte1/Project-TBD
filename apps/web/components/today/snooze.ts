import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** `iso` (yyyy-MM-dd) plus `days`, in pure calendar arithmetic — no timezone reinterpretation, so
 * it can't drift a day depending on the machine's local zone. */
function addCalendarDays(iso: string, days: number): string {
  const parts = iso.split('-').map(Number);
  const [year = 0, month = 1, day = 1] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The ISO instant for 7:00 AM, `daysFromNow` calendar days out, in the student's timezone —
 * feeds `snoozed_until` for both the queue's keyboard shortcut ('s' = 1 day) and its Snooze menu
 * (Until tomorrow / Three days / A week).
 */
export function computeSnoozeUntil(now: Date, timezone: string, daysFromNow: number): string {
  const todayIso = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const targetIso = addCalendarDays(todayIso, daysFromNow);
  return fromZonedTime(`${targetIso}T07:00:00`, timezone).toISOString();
}
