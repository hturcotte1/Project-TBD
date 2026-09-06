import type { ApplicationDto, ApplicationItemDto } from '@apogee/shared/api';

/** Applications whose submission work is effectively done — grouped at the bottom of the list. */
export function isSubmittedApplication(application: ApplicationDto): boolean {
  return application.status === 'submitted' || application.status === 'decision_received';
}

/**
 * Nearest deadline first; anything already submitted (or decided) sinks to the bottom regardless
 * of its deadline, since there is nothing left to act on before it.
 */
export function sortApplications(applications: ApplicationDto[]): ApplicationDto[] {
  return [...applications].sort((a, b) => {
    const aSubmitted = isSubmittedApplication(a) ? 1 : 0;
    const bSubmitted = isSubmittedApplication(b) ? 1 : 0;
    if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;
    if (a.days_remaining !== b.days_remaining) return a.days_remaining - b.days_remaining;
    return a.school.name.localeCompare(b.school.name);
  });
}

export interface GroupedApplications {
  active: ApplicationDto[];
  submitted: ApplicationDto[];
}

/** Splits the sorted list into the active section and the "Submitted" section. */
export function groupApplications(applications: ApplicationDto[]): GroupedApplications {
  const sorted = sortApplications(applications);
  return {
    active: sorted.filter((a) => !isSubmittedApplication(a)),
    submitted: sorted.filter((a) => isSubmittedApplication(a)),
  };
}

export type SchoolSortColumn = 'name' | 'deadline' | 'completion';
export type SortDirection = 'asc' | 'desc';

export interface SchoolSort {
  column: SchoolSortColumn;
  direction: SortDirection;
}

export const DEFAULT_SCHOOL_SORT: SchoolSort = { column: 'deadline', direction: 'asc' };

/**
 * Ascending comparator for an optional day count. `null` (no resolved deadline) always sorts
 * after any number, in either direction — only the ordering among the non-null values flips with
 * `direction`. Takes primitives rather than an `ApplicationDto` so it stays testable on its own;
 * `ApplicationDto.days_remaining` is never actually null today, but this keeps the column honest
 * if a school's deadline is ever unresolved.
 */
export function compareDaysRemaining(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const diff = a - b;
  return direction === 'asc' ? diff : -diff;
}

/** Sorts by one clickable table column. Ties (and the deadline column's null case) fall back to the school name so row order never jitters between renders. */
export function sortApplicationsByColumn(applications: ApplicationDto[], sort: SchoolSort): ApplicationDto[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...applications].sort((a, b) => {
    const primary =
      sort.column === 'name'
        ? sign * a.school.name.localeCompare(b.school.name)
        : sort.column === 'completion'
          ? sign * (a.completion_percent - b.completion_percent)
          : compareDaysRemaining(a.days_remaining, b.days_remaining, sort.direction);
    return primary !== 0 ? primary : a.school.name.localeCompare(b.school.name);
  });
}

const OPEN_ITEM_STATUSES = new Set<ApplicationItemDto['status']>(['missing', 'in_progress', 'blocked']);

/** The items still worth acting on for one school, highest importance first, capped to `limit` — the row expansion's short "what's left" list. */
export function openChecklistItems(items: ApplicationItemDto[], limit = 5): ApplicationItemDto[] {
  return items
    .filter((item) => OPEN_ITEM_STATUSES.has(item.status))
    .sort((a, b) => b.importance - a.importance || a.title.localeCompare(b.title))
    .slice(0, limit);
}
