import type { TimelineEntryDto } from '@apogee/shared/api';

export interface CalendarDay {
  /** YYYY-MM-DD */
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  entries: TimelineEntryDto[];
}

export interface CalendarMonth {
  year: number;
  /** 1-12 */
  month: number;
  weeks: CalendarDay[][];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoOfUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function groupEntriesByDate(entries: TimelineEntryDto[]): Map<string, TimelineEntryDto[]> {
  const byDate = new Map<string, TimelineEntryDto[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  return byDate;
}

/**
 * Builds a Sunday-start month grid covering exactly the weeks that touch `year`/`month` (4-6
 * rows depending on the month), padded with the leading/trailing days of neighboring months so
 * every row has 7 days. All arithmetic is done in UTC so the grid is independent of the runtime's
 * local timezone — `todayIso` and every entry's `date` are already resolved calendar days.
 */
export function buildCalendarMonth(entries: TimelineEntryDto[], year: number, month: number, todayIso: string): CalendarMonth {
  const entriesByDate = groupEntriesByDate(entries);
  const monthIndex0 = month - 1;

  const firstOfMonth = new Date(Date.UTC(year, monthIndex0, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  const gridStart = new Date(Date.UTC(year, monthIndex0, 1 - firstOfMonth.getUTCDay()));
  const gridEnd = new Date(Date.UTC(year, monthIndex0, lastOfMonth.getUTCDate() + (6 - lastOfMonth.getUTCDay())));

  const days: CalendarDay[] = [];
  for (const cursor = new Date(gridStart); cursor <= gridEnd; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = isoOfUtc(cursor);
    days.push({
      iso,
      day: cursor.getUTCDate(),
      inMonth: cursor.getUTCFullYear() === year && cursor.getUTCMonth() === monthIndex0,
      isToday: iso === todayIso,
      entries: entriesByDate.get(iso) ?? [],
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { year, month, weeks };
}

/** Normalizes year/month after adding `delta` months (handles wraparound in both directions). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  const normalizedMonth = ((total % 12) + 12) % 12;
  return { year: Math.floor(total / 12), month: normalizedMonth + 1 };
}

export interface TimelineMonthGroup {
  year: number;
  month: number;
  /** e.g. "November 2026" */
  label: string;
  entries: TimelineEntryDto[];
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Groups entries by calendar month for the list view, sorted chronologically inside and across groups. */
export function groupEntriesByMonth(entries: TimelineEntryDto[]): TimelineMonthGroup[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const groups = new Map<string, TimelineMonthGroup>();
  for (const entry of sorted) {
    const [yearStr, monthStr] = entry.date.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const key = `${year}-${month}`;
    let group = groups.get(key);
    if (!group) {
      group = { year, month, label: `${MONTH_LABELS[month - 1]} ${year}`, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}
