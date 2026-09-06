import type { TimelineEntryDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { layoutRunway } from '@/components/timeline/runway';

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

describe('layoutRunway', () => {
  it('positions today at 0 and an entry pxPerDay times its distance from today', () => {
    const layout = layoutRunway([entry({ date: '2026-09-10', days_remaining: 4 })], '2026-09-06', 12, 0);
    expect(layout.todayX).toBe(0);
    expect(layout.ticks).toHaveLength(1);
    expect(layout.ticks[0]!.x).toBe(4 * 12);
  });

  it('gives an application deadline a taller tick than every other kind', () => {
    const layout = layoutRunway(
      [entry({ date: '2026-09-10', kind: 'application_deadline' }), entry({ date: '2026-09-12', kind: 'item_due' })],
      '2026-09-06',
      12,
      0,
    );
    expect(layout.ticks[0]!.height).toBe(12);
    expect(layout.ticks[1]!.height).toBe(8);
  });

  it('stacks entries that share a date by increasing height, capped at 4', () => {
    const shared = Array.from({ length: 5 }, (_, i) => entry({ date: '2026-09-10', kind: 'item_due', title: `Item ${i}` }));
    const layout = layoutRunway(shared, '2026-09-06', 12, 0);
    const heights = layout.ticks.map((tick) => tick.height);
    // base 8, +6 per stack level, capped at index 3 (the 4th and 5th entries share the tallest tier).
    expect(heights).toEqual([8, 14, 20, 26, 26]);
    // Every entry in the group sits at the same x — they stack in height, not sideways.
    expect(new Set(layout.ticks.map((t) => t.x)).size).toBe(1);
  });

  it('extends the domain left of today for a past (overdue) entry', () => {
    const layout = layoutRunway([entry({ date: '2026-09-01', days_remaining: -5 })], '2026-09-06', 12, 0);
    expect(layout.todayX).toBe(5 * 12);
    expect(layout.ticks[0]!.x).toBe(0);
  });

  it('labels month boundaries after the domain start, without a year suffix within the same year', () => {
    const layout = layoutRunway([entry({ date: '2026-11-01' })], '2026-09-06', 12, 0);
    expect(layout.months.map((m) => m.label)).toEqual(['Oct', 'Nov']);
    expect(layout.months[0]!.x).toBe(25 * 12); // Sep 6 -> Oct 1 is 25 days.
  });

  it('adds the year to a month label once the boundary crosses into a later year', () => {
    const layout = layoutRunway([entry({ date: '2027-01-15' })], '2026-12-20', 12, 0);
    expect(layout.months.map((m) => m.label)).toEqual(['Jan 2027']);
  });

  it('never lays out narrower than minWidth, even for a short span', () => {
    const layout = layoutRunway([entry({ date: '2026-09-08' })], '2026-09-06', 12, 800);
    expect(layout.width).toBe(800);
  });

  it('widens past minWidth once the span needs more room', () => {
    const layout = layoutRunway([entry({ date: '2027-06-01' })], '2026-09-06', 12, 200);
    expect(layout.width).toBeGreaterThan(200);
  });
});
