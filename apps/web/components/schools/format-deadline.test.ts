import { describe, expect, it } from 'vitest';
import { formatDeadlineDate } from '@/components/schools/format-deadline';

describe('formatDeadlineDate', () => {
  it('formats as month-abbreviation and day, with no weekday or year', () => {
    expect(formatDeadlineDate('2026-11-01', 'America/New_York')).toBe('Nov 1');
    expect(formatDeadlineDate('2027-01-10', 'America/New_York')).toBe('Jan 10');
  });

  it('keeps the calendar date the same across timezones (noon-anchored, so no DST/midnight edge case shifts it)', () => {
    expect(formatDeadlineDate('2026-11-01', 'America/Los_Angeles')).toBe('Nov 1');
    expect(formatDeadlineDate('2026-11-01', 'Pacific/Auckland')).toBe('Nov 1');
  });
});
