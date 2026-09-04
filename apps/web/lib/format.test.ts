import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, relativeDays, relativeTimeFromNow } from '@/lib/format';

describe('relativeDays', () => {
  it('labels the near cases in plain language', () => {
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(1)).toBe('tomorrow');
    expect(relativeDays(-1)).toBe('yesterday');
  });

  it('labels the future as "in N days"', () => {
    expect(relativeDays(12)).toBe('in 12 days');
    expect(relativeDays(2)).toBe('in 2 days');
  });

  it('labels the past as "N days ago"', () => {
    expect(relativeDays(-3)).toBe('3 days ago');
    expect(relativeDays(-30)).toBe('30 days ago');
  });
});

describe('formatDate', () => {
  it('renders a date-only ISO string in the given timezone without drifting a day', () => {
    // A date-only string parsed naively at UTC midnight and shown in a western-hemisphere zone
    // would drift to the previous day; formatDate must not do that.
    expect(formatDate('2026-11-01', 'America/Chicago')).toBe('Sun, Nov 1');
    expect(formatDate('2026-01-01', 'Pacific/Kiritimati')).toBe('Thu, Jan 1');
  });
});

describe('formatDateTime', () => {
  it('renders a full timestamp in the given timezone', () => {
    expect(formatDateTime('2026-09-04T20:45:00.000Z', 'America/Chicago')).toBe('Sep 4, 2026, 3:45 PM');
  });
});

describe('relativeTimeFromNow', () => {
  it('is deterministic against a fixed "now"', () => {
    const now = new Date('2026-09-04T12:00:00.000Z');
    expect(relativeTimeFromNow('2026-09-04T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(relativeTimeFromNow('2026-09-04T12:05:00.000Z', now)).toBe('in 5 minutes');
  });
});
