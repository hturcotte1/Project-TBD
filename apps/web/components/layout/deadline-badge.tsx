import { relativeDays } from '@/lib/format';
import { heatTextClass } from '@/lib/urgency';
import { cn } from '@/lib/utils';

export interface DeadlineBadgeProps {
  daysRemaining: number | null;
  /** Overrides the auto label (e.g. show the date instead of "in 12 days"). */
  label?: string;
  className?: string;
}

/** Transitional: the legacy pages still import this; every rebuilt page uses system/days-figure. */
export function DeadlineBadge({ daysRemaining, label, className }: DeadlineBadgeProps) {
  const text = label ?? (daysRemaining === null ? 'no deadline' : relativeDays(daysRemaining));
  return <span className={cn('text-12 tabular-nums', heatTextClass(daysRemaining), className)}>{text}</span>;
}
