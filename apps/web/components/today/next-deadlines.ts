import type { ApplicationDto } from '@apogee/shared/api';

export interface UpcomingDeadline {
  schoolName: string;
  daysRemaining: number;
}

/** Applications with no decision yet, soonest deadline first — "active" for the purpose of the
 * countdown's "then" sentence. */
function activeSortedByDeadline(applications: ApplicationDto[]): ApplicationDto[] {
  return [...applications].filter((application) => application.decision === null).sort((a, b) => a.days_remaining - b.days_remaining);
}

/** The (at most) two deadlines after the nearest one, for Today's "Then X in N and Y in M."
 * sentence — the nearest itself is already the countdown's own number, so it's skipped here. */
export function getFollowingDeadlines(applications: ApplicationDto[]): UpcomingDeadline[] {
  return activeSortedByDeadline(applications)
    .slice(1, 3)
    .map((application) => ({ schoolName: application.school.name, daysRemaining: application.days_remaining }));
}

/** "Then Georgia Tech in 59 and Purdue in 60." / "Then Purdue in 60." / null when there's nothing
 * to add after the nearest deadline. */
export function buildThenSentence(deadlines: UpcomingDeadline[]): string | null {
  if (deadlines.length === 0) return null;
  const clauses = deadlines.map((deadline) => `${deadline.schoolName} in ${deadline.daysRemaining}`);
  if (clauses.length === 1) return `Then ${clauses[0]}.`;
  return `Then ${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}.`;
}
