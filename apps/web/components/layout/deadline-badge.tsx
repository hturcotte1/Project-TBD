import { Badge } from '@/components/ui/badge';
import { relativeDays } from '@/lib/format';
import { urgencyTone } from '@/lib/urgency';

const VARIANT_BY_TONE = { critical: 'urgent', warning: 'warn', neutral: 'outline' } as const;

export interface DeadlineBadgeProps {
  daysRemaining: number | null;
  /** Overrides the auto label (e.g. show the date instead of "in 12 days"). */
  label?: string;
  className?: string;
}

export function DeadlineBadge({ daysRemaining, label, className }: DeadlineBadgeProps) {
  const tone = urgencyTone(daysRemaining);
  const text = label ?? (daysRemaining === null ? 'no deadline' : relativeDays(daysRemaining));
  return (
    <Badge variant={VARIANT_BY_TONE[tone]} className={className}>
      {text}
    </Badge>
  );
}
