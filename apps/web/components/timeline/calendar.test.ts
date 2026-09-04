import type { TimelineEntryDto } from '@tbd/shared/api';
import { describe, expect, it } from 'vitest';
import { buildCalendarMonth, groupEntriesByMonth, shiftMonth } from '@/components/timeline/calendar';

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

describe('buildCalendarMonth', () => {
  it('pads a month that does not start on Sunday with the neighboring month\'s days', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const grid = buildCalendarMonth([], 2026, 9, '2026-09-04');
    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks[0]).toHaveLength(7);

    const firstWeek = grid.weeks[0]!;
    expect(firstWeek[0]!.iso).toBe('2026-08-30');
    expect(firstWeek[0]!.inMonth).toBe(false);
    expect(firstWeek[2]!.iso).toBe('2026-09-01');
    expect(firstWeek[2]!.inMonth).toBe(true);

    const lastWeek = grid.weeks.at(-1)!;
    expect(lastWeek[3]!.iso).toBe('2026-09-30');
    expect(lastWeek[3]!.inMonth).toBe(true);
    expect(lastWeek[4]!.iso).toBe('2026-10-01');
    expect(lastWeek[4]!.inMonth).toBe(false);
  });

  it('needs no padding on either end when the month starts on a Sunday and ends on a Saturday-adjacent day', () => {
    // November 2026 starts on a Sunday.
    const grid = buildCalendarMonth([], 2026, 11, '2026-11-01');
    expect(grid.weeks[0]![0]!.iso).toBe('2026-11-01');
    expect(grid.weeks[0]![0]!.inMonth).toBe(true);
  });

  it('marks exactly the day matching todayIso as today', () => {
    const grid = buildCalendarMonth([], 2026, 9, '2026-09-04');
    const flat = grid.weeks.flat();
    const todays = flat.filter((d) => d.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]!.iso).toBe('2026-09-04');
  });

  it('attaches every entry to its matching day, and leaves other days empty', () => {
    const entries = [
      entry({ date: '2026-09-04', title: 'Sync' }),
      entry({ date: '2026-09-04', title: 'Also today' }),
      entry({ date: '2026-11-01', title: 'Not this month, dropped from the grid but not the count' }),
    ];
    const grid = buildCalendarMonth(entries, 2026, 9, '2026-09-04');
    const flat = grid.weeks.flat();
    const sep4 = flat.find((d) => d.iso === '2026-09-04')!;
    expect(sep4.entries.map((e) => e.title)).toEqual(['Sync', 'Also today']);
    const sep5 = flat.find((d) => d.iso === '2026-09-05')!;
    expect(sep5.entries).toEqual([]);
  });
});

describe('shiftMonth', () => {
  it('moves forward within a year', () => {
    expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month: 10 });
  });

  it('moves backward within a year', () => {
    expect(shiftMonth(2026, 9, -1)).toEqual({ year: 2026, month: 8 });
  });

  it('rolls over into the next year', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles multi-month jumps', () => {
    expect(shiftMonth(2026, 9, 6)).toEqual({ year: 2027, month: 3 });
    expect(shiftMonth(2026, 1, -13)).toEqual({ year: 2024, month: 12 });
  });
});

describe('groupEntriesByMonth', () => {
  it('groups by calendar month, sorted chronologically', () => {
    const entries = [
      entry({ date: '2027-01-10', title: 'Georgetown RD' }),
      entry({ date: '2026-11-01', title: 'UMich EA' }),
      entry({ date: '2026-11-01', title: 'Northwestern ED' }),
      entry({ date: '2027-01-01', title: 'Emory RD' }),
    ];
    const groups = groupEntriesByMonth(entries);
    expect(groups.map((g) => g.label)).toEqual(['November 2026', 'January 2027']);
    expect(groups[0]!.entries.map((e) => e.title)).toEqual(['UMich EA', 'Northwestern ED']);
    expect(groups[1]!.entries.map((e) => e.title)).toEqual(['Emory RD', 'Georgetown RD']);
  });

  it('returns an empty list for no entries', () => {
    expect(groupEntriesByMonth([])).toEqual([]);
  });
});
