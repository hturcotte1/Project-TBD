import type { ApplicationPlan } from '@apogee/shared/domain';

/** Real-world Common App plan rules a student can accidentally violate while building their list. */
export function detectPlanConflicts(plans: ApplicationPlan[]): string[] {
  const warnings: string[] = [];
  const edCount = plans.filter((p) => p === 'ED' || p === 'ED2').length;
  const reaCount = plans.filter((p) => p === 'REA').length;

  if (edCount > 1) {
    warnings.push('More than one Early Decision plan is selected. ED is binding, so you can only commit to one school.');
  }
  if (edCount > 0 && reaCount > 0) {
    warnings.push('Early Decision and Restrictive Early Action together often aren’t allowed. Check both schools’ policies before applying this way.');
  }
  return warnings;
}
