import { cn } from '@/lib/utils';

export interface CompletionGroup {
  label: string;
  done: number;
  total: number;
}

export interface CompletionSegment extends CompletionGroup {
  /** This group's share of the bar's width, in percent. Zero-total groups never appear here. */
  widthPercent: number;
}

/** Pure width math for CompletionBar, split out so it's unit-testable without rendering. */
export function segmentWidths(groups: CompletionGroup[]): CompletionSegment[] {
  const visible = groups.filter((group) => group.total > 0);
  const sum = visible.reduce((total, group) => total + group.total, 0);
  if (sum === 0) return [];
  return visible.map((group) => ({ ...group, widthPercent: (group.total / sum) * 100 }));
}

export interface CompletionBarProps {
  groups: CompletionGroup[];
  className?: string;
}

/** A thin multi-group progress bar: one segment per group, sized by its share of the total items,
 * each segment's own done/total fraction filled in the quieter of the two grays. */
export function CompletionBar({ groups, className }: CompletionBarProps) {
  const segments = segmentWidths(groups);
  const totalDone = groups.reduce((sum, group) => sum + group.done, 0);
  const totalAll = groups.reduce((sum, group) => sum + group.total, 0);
  const title = groups.map((group) => `${group.label} ${group.done} of ${group.total}`).join(', ');

  return (
    <div
      className={cn('flex h-1.5 w-full gap-0.5', className)}
      role="img"
      aria-label={`${totalDone} of ${totalAll} items done`}
      title={title}
    >
      {segments.map((segment, index) => (
        <div
          key={segment.label}
          className={cn(
            'h-full overflow-hidden bg-line',
            index === 0 && 'rounded-l-full',
            index === segments.length - 1 && 'rounded-r-full',
          )}
          style={{ width: `${segment.widthPercent}%` }}
        >
          <div className="h-full bg-fg-2" style={{ width: `${(segment.done / segment.total) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
