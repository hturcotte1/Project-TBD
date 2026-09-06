import type { TimelineEntryDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { formatShortDate, groupEntriesByMonth } from '@/components/timeline/agenda';

function entry(overrides: Partial<TimelineEntryDto> & { date: string }): TimelineEntryDto {
  return {
    days_remaining: 0,
    title: 'Entry',
    kind: 'application_deadline',
    application_id: null,
    application_item_id: null,
    school_name: null,
    status: null,
    ...overrides,
  };
}

describe('groupEntriesByMonth', () => {
  it('groups by calendar month, sorted chronologically inside and across groups', () => {
    const entries = [
      entry({ date: '2027-01-10', title: 'Georgetown RD' }),
      entry({ date: '2026-11-01', title: 'UMich EA' }),
      entry({ date: '2026-11-01', title: 'Northwestern ED' }),
      entry({ date: '2027-01-01', title: 'Emory RD' }),
    ];
    const groups = groupEntriesByMonth(entries, '2026-09-06');
    expect(groups.map((g) => g.label)).toEqual(['November 2026', 'January 2027']);
    expect(groups[0]!.entries.map((e) => e.title)).toEqual(['Northwestern ED', 'UMich EA']);
    expect(groups[1]!.entries.map((e) => e.title)).toEqual(['Emory RD', 'Georgetown RD']);
  });

  it('marks a month strictly before today\'s month as past, and today\'s own month as not past', () => {
    const entries = [entry({ date: '2026-08-15' }), entry({ date: '2026-09-01' }), entry({ date: '2026-10-01' })];
    const groups = groupEntriesByMonth(entries, '2026-09-06');
    expect(groups.find((g) => g.key === '2026-08')!.isPast).toBe(true);
    expect(groups.find((g) => g.key === '2026-09')!.isPast).toBe(false);
    expect(groups.find((g) => g.key === '2026-10')!.isPast).toBe(false);
  });

  it('returns an empty list for no entries', () => {
    expect(groupEntriesByMonth([], '2026-09-06')).toEqual([]);
  });
});

describe('formatShortDate', () => {
  it('formats a date-only string as month and day, no weekday or year', () => {
    expect(formatShortDate('2026-11-01', 'America/New_York')).toBe('Nov 1');
  });
});
