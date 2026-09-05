import type { ApplicationDto } from '@apogee/shared/api';

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
