/**
 * Deadline urgency as one warm signal in six steps, so every screen that shows a due date agrees
 * on how hot it is. Step 0 (far, or no deadline) carries no signal and is set in secondary text.
 * The scale and its colors are in docs/DESIGN.md.
 */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

export function heatStep(daysRemaining: number | null | undefined): HeatStep {
  if (daysRemaining === null || daysRemaining === undefined) return 0;
  if (daysRemaining < 0) return 5;
  if (daysRemaining <= 3) return 4;
  if (daysRemaining <= 7) return 3;
  if (daysRemaining <= 14) return 2;
  if (daysRemaining <= 30) return 1;
  return 0;
}

/** Text color class for a step. Numbers and words only; never a background. */
export const HEAT_TEXT_CLASSES: Record<HeatStep, string> = {
  0: 'text-fg-2',
  1: 'text-heat-1',
  2: 'text-heat-2',
  3: 'text-heat-3',
  4: 'text-heat-4',
  5: 'text-heat-5',
};

/** Background class for the thin bars that carry heat (word-count gauge, runway ticks). */
export const HEAT_BAR_CLASSES: Record<HeatStep, string> = {
  0: 'bg-fg-2',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
  4: 'bg-heat-4',
  5: 'bg-heat-5',
};

export function heatTextClass(daysRemaining: number | null | undefined): string {
  return HEAT_TEXT_CLASSES[heatStep(daysRemaining)];
}

/** Plain words for a step, for tooltips and screen readers. */
export const HEAT_LABELS: Record<HeatStep, string> = {
  0: 'more than a month away',
  1: 'within a month',
  2: 'within two weeks',
  3: 'within a week',
  4: 'within three days',
  5: 'overdue',
};
