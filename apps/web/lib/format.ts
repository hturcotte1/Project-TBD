import { formatDistanceStrict } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** "Sun, Nov 1" for a date-only ISO string (YYYY-MM-DD), resolved in the student's zone. */
export function formatDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'EEE, MMM d');
}

/** "Sun, Nov 1, 2026" including the year. */
export function formatDateWithYear(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'EEE, MMM d, yyyy');
}

/** "3:45 PM" local wall-clock time for a full ISO timestamp. */
export function formatTime(dateTimeIso: string, timezone: string): string {
  return formatInTimeZone(new Date(dateTimeIso), timezone, 'h:mm a');
}

/** "Sep 4, 2026, 3:45 PM" for a full ISO timestamp. */
export function formatDateTime(dateTimeIso: string, timezone: string): string {
  return formatInTimeZone(new Date(dateTimeIso), timezone, 'MMM d, yyyy, h:mm a');
}

/**
 * "today" / "tomorrow" / "in 12 days" / "yesterday" / "3 days ago" from a calendar-day integer
 * (the API already resolves days-remaining in the student's zone; this only labels it).
 */
export function relativeDays(daysRemaining: number): string {
  if (daysRemaining === 0) return 'today';
  if (daysRemaining === 1) return 'tomorrow';
  if (daysRemaining === -1) return 'yesterday';
  if (daysRemaining > 1) return `in ${daysRemaining} days`;
  return `${Math.abs(daysRemaining)} days ago`;
}

/** "3 hours ago" / "in 5 minutes" for a full ISO timestamp, relative to `now` (defaults to the real clock). */
export function relativeTimeFromNow(dateTimeIso: string, now: Date = new Date()): string {
  return formatDistanceStrict(new Date(dateTimeIso), now, { addSuffix: true });
}
