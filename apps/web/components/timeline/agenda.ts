import type { TimelineEntryDto } from '@apogee/shared/api';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const MONTH_LABELS = [
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

export interface TimelineMonthGroup {
  /** "2026-11", sortable and stable as a React key. */
  key: string;
  year: number;
  /** 1-12 */
  month: number;
  /** "November 2026" */
  label: string;
  entries: TimelineEntryDto[];
  /** True when the whole month is before the student's current month — collapsed by default. */
  isPast: boolean;
}

/** Groups entries by calendar month, sorted chronologically inside and across groups. `today` (a
 * resolved YYYY-MM-DD) decides which months count as past. */
export function groupEntriesByMonth(entries: TimelineEntryDto[], today: string): TimelineMonthGroup[] {
  const todayKey = today.slice(0, 7);
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title)));
  const groups = new Map<string, TimelineMonthGroup>();
  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      const [yearStr, monthStr] = entry.date.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      group = { key, year, month, label: `${MONTH_LABELS[month - 1]} ${year}`, entries: [], isPast: key < todayKey };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

/** "Nov 1" — month and day only, no weekday or year, resolved in the student's zone. Noon is used
 * as the anchor instant (matching lib/format.ts) so a date-only string never lands on the wrong
 * side of midnight from a DST shift. */
export function formatShortDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'MMM d');
}
