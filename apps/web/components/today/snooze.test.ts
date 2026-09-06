import { describe, expect, it } from 'vitest';
import { computeSnoozeUntil } from './snooze';

describe('computeSnoozeUntil', () => {
  it('lands on 7am tomorrow in the timezone, converted to UTC', () => {
    // Sep 5 23:30 UTC is Sep 5 18:30 CDT (America/Chicago is UTC-5 in September); tomorrow at
    // 7:00 CDT is Sep 6, 12:00 UTC.
    const now = new Date('2026-09-05T23:30:00Z');
    expect(computeSnoozeUntil(now, 'America/Chicago', 1)).toBe('2026-09-06T12:00:00.000Z');
  });

  it('crosses a month boundary correctly', () => {
    const now = new Date('2026-08-31T12:00:00Z');
    expect(computeSnoozeUntil(now, 'America/Chicago', 1)).toBe('2026-09-01T12:00:00.000Z');
  });

  it('supports snoozing several days out (the "A week" option)', () => {
    const now = new Date('2026-09-05T12:00:00Z');
    expect(computeSnoozeUntil(now, 'America/Chicago', 7)).toBe('2026-09-12T12:00:00.000Z');
  });
});
