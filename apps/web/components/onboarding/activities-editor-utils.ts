import { MAX_ACTIVITIES } from '@apogee/shared/schemas';

/** Common App's activity description limit, enforced client-side to match `ActivityInput.description`. */
export const DESCRIPTION_MAX_LENGTH = 150;

export { MAX_ACTIVITIES };

/** Characters left in the 150-char description limit (negative once over). */
export function descriptionRemaining(description: string): number {
  return DESCRIPTION_MAX_LENGTH - description.length;
}

/** Whether one more activity can be added given the current count (Common App caps at 10). */
export function canAddActivity(count: number): boolean {
  return count < MAX_ACTIVITIES;
}
