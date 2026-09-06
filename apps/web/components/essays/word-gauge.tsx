import { wordGaugeStep, wordProgressPercent, wordsGaugeLabel } from '@/components/essays/word-count';
import type { AutosaveStatus } from '@/components/essays/use-autosave';
import { HEAT_BAR_CLASSES, HEAT_TEXT_CLASSES } from '@/lib/urgency';
import { cn } from '@/lib/utils';

const AUTOSAVE_WORD: Record<AutosaveStatus, string> = {
  saved: 'Saved',
  pending: 'Saving',
  saving: 'Saving',
  offline: 'Offline',
};

/** The word-count gauge and the one-word autosave status, right-aligned above the editor. A
 * separate component from the textarea itself so it can span the full editor+margin width (its
 * own grid row) while the textarea and the anchored notes column stay vertically aligned in the
 * row beneath it. */
export function WordGauge({ count, limit, autosaveStatus, className }: { count: number; limit: number | null; autosaveStatus: AutosaveStatus; className?: string }) {
  const step = wordGaugeStep(count, limit);
  const percent = wordProgressPercent(count, limit) ?? 0;

  return (
    <div className={cn('flex items-center justify-end gap-3', className)}>
      <div className="h-1.5 w-[160px] overflow-hidden rounded-full bg-line">
        <div className={cn('h-full rounded-full', HEAT_BAR_CLASSES[step])} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn('text-12 tabular-nums', HEAT_TEXT_CLASSES[step])}>{wordsGaugeLabel(count, limit)}</span>
      <span className="text-12 text-fg-3">{AUTOSAVE_WORD[autosaveStatus]}</span>
    </div>
  );
}
