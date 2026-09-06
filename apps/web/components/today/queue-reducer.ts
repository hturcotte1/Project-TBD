import type { NextActionDto } from '@apogee/shared/api';

export type MoveDirection = 1 | -1;

/** Wrapping index arithmetic for the queue's j/k navigation. `current === null` means nothing is
 * selected yet (an empty queue, or one that just became non-empty) — the first move lands on the
 * first row moving forward, or the last row moving backward. */
export function moveQueueSelection(current: number | null, direction: MoveDirection, length: number): number | null {
  if (length === 0) return null;
  if (current === null) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}

/** Where 'e'/Enter should navigate for a queue row. There's no item-to-essay map on this page, so
 * an action with no linked application does nothing, per spec. */
export function resolveActionHref(action: Pick<NextActionDto, 'application_id'>): string | null {
  return action.application_id ? `/schools/${action.application_id}` : null;
}
