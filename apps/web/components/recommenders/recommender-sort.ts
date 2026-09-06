/**
 * Ordering and the "nearest deadline" figure for the Recommenders table. Each assignment carries
 * its own deadline (an ISO date, so lexicographic comparison is also chronological); a
 * recommender's own days-remaining comes from the matching application, which the API already
 * resolves against the student's timezone.
 */
import type { ApplicationDto, RecommenderDto } from '@apogee/shared/api';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** "Nov 1" — the compact deadline date for the Nearest deadline column, which already carries the
 * day count right next to it; `lib/format.ts`'s `formatDate` adds a weekday that would crowd it. */
export function formatDeadlineDate(dateIso: string, timezone: string): string {
  return formatInTimeZone(fromZonedTime(`${dateIso}T12:00:00`, timezone), timezone, 'MMM d');
}

export interface NearestDeadline {
  deadline: string;
  daysRemaining: number | null;
}

/** The soonest-due assignment's deadline, or null when the recommender covers no school. */
export function nearestDeadline(recommender: RecommenderDto, applicationsById: Map<string, ApplicationDto>): NearestDeadline | null {
  let nearest: RecommenderDto['assignments'][number] | null = null;
  for (const assignment of recommender.assignments) {
    if (!nearest || assignment.deadline < nearest.deadline) nearest = assignment;
  }
  if (!nearest) return null;
  return { deadline: nearest.deadline, daysRemaining: applicationsById.get(nearest.application_id)?.days_remaining ?? null };
}

/** Nearest deadline first (recommenders with no school last), ties broken by name. */
export function sortRecommenders(recommenders: RecommenderDto[], applicationsById: Map<string, ApplicationDto>): RecommenderDto[] {
  return [...recommenders].sort((a, b) => {
    const nearestA = nearestDeadline(a, applicationsById);
    const nearestB = nearestDeadline(b, applicationsById);
    if (nearestA && nearestB && nearestA.deadline !== nearestB.deadline) {
      return nearestA.deadline < nearestB.deadline ? -1 : 1;
    }
    if (nearestA && !nearestB) return -1;
    if (!nearestA && nearestB) return 1;
    return a.name.localeCompare(b.name);
  });
}
