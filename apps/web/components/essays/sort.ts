import type { EssayDto } from '@apogee/shared/api';

/** Nearest due date first (essays with no due date last); ties broken by school name. Moved
 * verbatim from the old essays page — the ordering rule itself hasn't changed. */
export function sortEssays(essays: EssayDto[]): EssayDto[] {
  return [...essays].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return (a.school_name ?? '').localeCompare(b.school_name ?? '');
  });
}
