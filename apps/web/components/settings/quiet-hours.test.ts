import { describe, expect, it } from 'vitest';
import { isWithinQuietHours, validateQuietHours } from '@/components/settings/quiet-hours';

describe('validateQuietHours', () => {
  it('accepts a normal overnight window', () => {
    expect(validateQuietHours({ start: '22:00', end: '07:00' })).toBeNull();
  });

  it('accepts a same-day window', () => {
    expect(validateQuietHours({ start: '13:00', end: '15:30' })).toBeNull();
  });

  it('rejects identical start and end', () => {
    expect(validateQuietHours({ start: '09:00', end: '09:00' })).toMatch(/same time/);
  });

  it('rejects a malformed time', () => {
    expect(validateQuietHours({ start: '9:00', end: '07:00' })).toMatch(/HH:MM/);
    expect(validateQuietHours({ start: '25:00', end: '07:00' })).toMatch(/HH:MM/);
  });
});

describe('isWithinQuietHours', () => {
  const overnight = { start: '22:00', end: '07:00' };
  const sameDay = { start: '13:00', end: '15:30' };

  it('treats an overnight window as spanning midnight', () => {
    expect(isWithinQuietHours('23:00', overnight)).toBe(true);
    expect(isWithinQuietHours('03:00', overnight)).toBe(true);
    expect(isWithinQuietHours('12:00', overnight)).toBe(false);
    expect(isWithinQuietHours('22:00', overnight)).toBe(true);
    expect(isWithinQuietHours('07:00', overnight)).toBe(false);
  });

  it('handles a same-day window normally', () => {
    expect(isWithinQuietHours('14:00', sameDay)).toBe(true);
    expect(isWithinQuietHours('16:00', sameDay)).toBe(false);
    expect(isWithinQuietHours('12:59', sameDay)).toBe(false);
  });

  it('is always false for a degenerate identical window', () => {
    expect(isWithinQuietHours('10:00', { start: '09:00', end: '09:00' })).toBe(false);
  });
});
