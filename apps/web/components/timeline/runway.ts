import type { TimelineEntryDto } from '@apogee/shared/api';
import { HEAT_BAR_CLASSES, heatStep } from '@/lib/urgency';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY_MS = 86_400_000;

/** Tick height (px) for an application deadline vs every other kind — DESIGN.md gives deadlines
 * the taller mark since they are the primary object on the page. */
const DEADLINE_TICK_HEIGHT = 12;
const OTHER_TICK_HEIGHT = 8;
/** When several entries share a date, each subsequent one grows taller instead of drawing on top
 * of the last (which, at an identical x, would be visually indistinguishable from a single tick). */
const STACK_HEIGHT_STEP = 6;
const MAX_STACK = 4;

export interface RunwayTick {
  entry: TimelineEntryDto;
  /** px from the runway's left edge to the tick's center. */
  x: number;
  /** px tall, growing from the baseline. */
  height: number;
  /** One of HEAT_BAR_CLASSES, by the entry's own urgency. */
  colorClass: string;
}

export interface RunwayMonthTick {
  /** px from the runway's left edge to the boundary (the 1st of the month). */
  x: number;
  /** "Oct", or "Jan 2027" the first time a boundary lands in a later year than the previous one. */
  label: string;
}

export interface RunwayLayout {
  /** Total px width of the runway content — at least `minWidth`. */
  width: number;
  /** px from the left edge to today's tick. */
  todayX: number;
  ticks: RunwayTick[];
  months: RunwayMonthTick[];
}

function utcDay(iso: string): number {
  const [year, month, day] = iso.split('-');
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY_MS);
}

function isoOf(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/** `month` is always 1-12 here (derived from a parsed calendar date), so the lookup can't miss —
 * this just satisfies noUncheckedIndexedAccess without an assertion at every call site. */
function monthShort(month: number): string {
  return MONTH_SHORT[month - 1] ?? '';
}

/** The 1st of the month after year/month (1-12), wrapping December into next January. */
function nextMonthStart(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * Lays out the runway's geometry: where today, each entry, and every month boundary fall along a
 * day axis running at `pxPerDay`. The axis spans from the earliest date in play to the latest —
 * normally today to the last entry's date, but a past (overdue) entry pulls the start left of
 * today so it still has somewhere to sit. Pure and timezone-free: every date in and out is an
 * already-resolved calendar day (YYYY-MM-DD).
 */
export function layoutRunway(entries: TimelineEntryDto[], today: string, pxPerDay: number, minWidth: number): RunwayLayout {
  let minDate = today;
  let maxDate = today;
  for (const entry of entries) {
    if (entry.date < minDate) minDate = entry.date;
    if (entry.date > maxDate) maxDate = entry.date;
  }

  const spanDays = daysBetween(minDate, maxDate);
  const width = Math.max(minWidth, spanDays * pxPerDay + pxPerDay);

  const stackIndexByDate = new Map<string, number>();
  const ticks: RunwayTick[] = entries.map((entry) => {
    const stack = Math.min(stackIndexByDate.get(entry.date) ?? 0, MAX_STACK - 1);
    stackIndexByDate.set(entry.date, stack + 1);
    const base = entry.kind === 'application_deadline' ? DEADLINE_TICK_HEIGHT : OTHER_TICK_HEIGHT;
    return {
      entry,
      x: daysBetween(minDate, entry.date) * pxPerDay,
      height: base + stack * STACK_HEIGHT_STEP,
      colorClass: HEAT_BAR_CLASSES[heatStep(entry.days_remaining)],
    };
  });

  const months: RunwayMonthTick[] = [];
  const [minYearStr, minMonthStr] = minDate.split('-');
  let cursor = nextMonthStart(Number(minYearStr), Number(minMonthStr));
  let lastYear = Number(minYearStr);
  let cursorIso = isoOf(cursor.year, cursor.month);
  while (cursorIso <= maxDate) {
    const label = cursor.year === lastYear ? monthShort(cursor.month) : `${monthShort(cursor.month)} ${cursor.year}`;
    months.push({ x: daysBetween(minDate, cursorIso) * pxPerDay, label });
    lastYear = cursor.year;
    cursor = nextMonthStart(cursor.year, cursor.month);
    cursorIso = isoOf(cursor.year, cursor.month);
  }

  return { width, todayX: daysBetween(minDate, today) * pxPerDay, ticks, months };
}
