import { relativeDays } from '@/lib/format';
import { HEAT_LABELS, heatStep, heatTextClass } from '@/lib/urgency';
import { cn } from '@/lib/utils';

export type DaysFigureFormat = 'number' | 'relative';

export interface DaysFigureProps {
  days: number | null;
  format: DaysFigureFormat;
  className?: string;
}

/** "12" / "today" / "3 late" — the compact form used in dense rows and table cells. */
function numberFormat(days: number): string {
  if (days === 0) return 'today';
  if (days < 0) return `${Math.abs(days)} late`;
  return String(days);
}

/** A single heat-colored days figure, for table cells and inline mentions of a deadline. */
export function DaysFigure({ days, format, className }: DaysFigureProps) {
  const text = days === null ? '–' : format === 'relative' ? relativeDays(days) : numberFormat(days);
  return (
    <span className={cn('text-14 tabular-nums', heatTextClass(days), className)} title={HEAT_LABELS[heatStep(days)]}>
      {text}
    </span>
  );
}
