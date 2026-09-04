/**
 * Client-side validation for the quiet-hours pair before it's sent to `settingsUpdate`. The
 * contract's `QuietHours` schema only checks the "HH:MM" shape of each field independently — it
 * has no opinion on the pair, since an overnight window (e.g. 22:00 to 07:00) is valid and in fact
 * the common case. This only rejects a window that cannot mean anything: identical start and end.
 */
import type { QuietHours } from '@tbd/shared/schemas';

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm: string): number | null {
  const match = HHMM_PATTERN.exec(hhmm);
  if (!match) return null;
  const [, hours, minutes] = match;
  return Number(hours) * 60 + Number(minutes);
}

/** Returns an error message for an invalid quiet-hours pair, or null when it's fine to save. */
export function validateQuietHours(quietHours: QuietHours): string | null {
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null) return 'Enter both times as HH:MM.';
  if (start === end) return 'Start and end can’t be the same time — that would be quiet all day or never.';
  return null;
}

/** True if `time` (HH:MM) falls inside the overnight-aware quiet window [start, end). */
export function isWithinQuietHours(time: string, quietHours: QuietHours): boolean {
  const t = toMinutes(time);
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (t === null || start === null || end === null) return false;
  if (start === end) return false;
  if (start < end) return t >= start && t < end;
  // Overnight window, e.g. 22:00 -> 07:00: quiet from start through midnight, then midnight through end.
  return t >= start || t < end;
}
