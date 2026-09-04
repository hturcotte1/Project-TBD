import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { IsoDate } from '../schemas/common';
import type { QuietHours } from '../schemas/profile';

/** Today's date (YYYY-MM-DD) in the given IANA zone. */
export function localDate(now: Date, timezone: string): IsoDate {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/** "HH:MM" local wall-clock time. */
export function localTime(now: Date, timezone: string): string {
  return formatInTimeZone(now, timezone, 'HH:mm');
}

/** Local hour (0-23) in the zone. */
export function localHour(now: Date, timezone: string): number {
  return Number(formatInTimeZone(now, timezone, 'H'));
}

/** Day of week in the zone: 0 = Sunday. */
export function localDayOfWeek(now: Date, timezone: string): number {
  return Number(formatInTimeZone(now, timezone, 'i')) % 7;
}

/** Instant at which a deadline date ends (23:59:59.999 local). */
export function deadlineInstant(deadline: IsoDate, timezone: string): Date {
  return fromZonedTime(`${deadline}T23:59:59.999`, timezone);
}

/** Instant for a local wall-clock time on a given local date. */
export function localInstant(date: IsoDate, hhmm: string, timezone: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, timezone);
}

/**
 * Calendar days from the student's local today until the deadline date.
 * 0 = due today, negative = past.
 */
export function daysUntil(deadline: IsoDate, now: Date, timezone: string): number {
  const today = parseISO(localDate(now, timezone));
  return differenceInCalendarDays(parseISO(deadline), today);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseISO(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whether a local wall-clock "HH:MM" falls inside quiet hours (which may wrap midnight). */
export function isWithinQuietHours(hhmm: string, quiet: QuietHours): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const t = toMin(hhmm);
  const start = toMin(quiet.start);
  const end = toMin(quiet.end);
  if (start === end) return false;
  if (start < end) return t >= start && t < end;
  return t >= start || t < end;
}

export function isQuietNow(now: Date, timezone: string, quiet: QuietHours): boolean {
  return isWithinQuietHours(localTime(now, timezone), quiet);
}

/** Next instant at which quiet hours end (today or tomorrow in the zone). */
export function nextQuietHoursEnd(now: Date, timezone: string, quiet: QuietHours): Date {
  const today = localDate(now, timezone);
  const candidate = localInstant(today, quiet.end, timezone);
  return candidate > now ? candidate : localInstant(addDays(today, 1), quiet.end, timezone);
}

/** Convert an instant to a local Date object in the zone (for formatting). */
export function toLocal(now: Date, timezone: string): Date {
  return toZonedTime(now, timezone);
}

/** Human "Mon Nov 1" style label in the zone. */
export function formatLocalDate(date: IsoDate, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${date}T12:00:00`, timezone), timezone, 'EEE MMM d');
}

/** ISO week start (Monday) for a local date. */
export function weekStartOf(date: IsoDate): IsoDate {
  const d = parseISO(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}
