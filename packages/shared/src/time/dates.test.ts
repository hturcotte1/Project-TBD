import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysUntil,
  deadlineInstant,
  isQuietNow,
  isWithinQuietHours,
  localDate,
  localDayOfWeek,
  localHour,
  nextQuietHoursEnd,
  weekStartOf,
} from './dates';

const NY = 'America/New_York';
const LA = 'America/Los_Angeles';

describe('deadline math', () => {
  it('counts calendar days in the student zone, not UTC', () => {
    // 11:30pm Oct 31 in New York is already Nov 1 in UTC.
    const now = new Date('2026-11-01T03:30:00Z');
    expect(localDate(now, NY)).toBe('2026-10-31');
    expect(daysUntil('2026-11-01', now, NY)).toBe(1);
    expect(daysUntil('2026-11-01', now, 'UTC')).toBe(0);
  });

  it('resolves a deadline to 23:59:59.999 local', () => {
    const at = deadlineInstant('2026-11-01', NY);
    expect(at.toISOString()).toBe('2026-11-02T04:59:59.999Z');
    expect(deadlineInstant('2026-11-01', LA).toISOString()).toBe('2026-11-02T07:59:59.999Z');
  });

  it('handles day-of and past deadlines', () => {
    const now = new Date('2026-11-01T15:00:00Z');
    expect(daysUntil('2026-11-01', now, NY)).toBe(0);
    expect(daysUntil('2026-10-30', now, NY)).toBe(-2);
  });

  it('addDays and weekStartOf', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekStartOf('2026-09-06')).toBe('2026-08-31'); // Sunday -> previous Monday
    expect(weekStartOf('2026-08-31')).toBe('2026-08-31');
  });
});

describe('quiet hours', () => {
  const quiet = { start: '22:00', end: '07:00' };
  it('wraps midnight', () => {
    expect(isWithinQuietHours('23:00', quiet)).toBe(true);
    expect(isWithinQuietHours('02:00', quiet)).toBe(true);
    expect(isWithinQuietHours('06:59', quiet)).toBe(true);
    expect(isWithinQuietHours('07:00', quiet)).toBe(false);
    expect(isWithinQuietHours('12:00', quiet)).toBe(false);
    expect(isWithinQuietHours('21:59', quiet)).toBe(false);
  });
  it('non-wrapping window', () => {
    const q = { start: '13:00', end: '15:00' };
    expect(isWithinQuietHours('14:00', q)).toBe(true);
    expect(isWithinQuietHours('16:00', q)).toBe(false);
  });
  it('is evaluated in the student zone', () => {
    const now = new Date('2026-09-05T03:00:00Z'); // 11pm NY, 8pm LA
    expect(isQuietNow(now, NY, quiet)).toBe(true);
    expect(isQuietNow(now, LA, quiet)).toBe(false);
    expect(localHour(now, NY)).toBe(23);
    expect(localDayOfWeek(now, NY)).toBe(5); // Friday
  });
  it('computes the next quiet-hours end', () => {
    const now = new Date('2026-09-05T03:00:00Z'); // 11pm Fri NY
    expect(nextQuietHoursEnd(now, NY, quiet).toISOString()).toBe('2026-09-05T11:00:00.000Z'); // 7am Sat NY
    const noon = new Date('2026-09-05T16:00:00Z');
    expect(nextQuietHoursEnd(noon, NY, quiet).toISOString()).toBe('2026-09-06T11:00:00.000Z');
  });
});
