/**
 * Deadline urgency, expressed as a small closed vocabulary so every screen that shows a due date
 * agrees on when it turns red. `null` (no known deadline) is always neutral.
 */
export type UrgencyTone = 'critical' | 'warning' | 'neutral';

const CRITICAL_THRESHOLD_DAYS = 3;
const WARNING_THRESHOLD_DAYS = 14;

export function urgencyTone(daysRemaining: number | null | undefined): UrgencyTone {
  if (daysRemaining === null || daysRemaining === undefined) return 'neutral';
  if (daysRemaining <= CRITICAL_THRESHOLD_DAYS) return 'critical';
  if (daysRemaining <= WARNING_THRESHOLD_DAYS) return 'warning';
  return 'neutral';
}

/** Tailwind class fragments for each tone, sharing the same border/bg/fg convention. */
export const URGENCY_TONE_CLASSES: Record<UrgencyTone, string> = {
  critical: 'bg-urgent-bg text-urgent border-urgent-border',
  warning: 'bg-warn-bg text-warn border-warn-border',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export const URGENCY_TONE_DOT_CLASSES: Record<UrgencyTone, string> = {
  critical: 'bg-urgent',
  warning: 'bg-warn',
  neutral: 'bg-muted-foreground',
};
