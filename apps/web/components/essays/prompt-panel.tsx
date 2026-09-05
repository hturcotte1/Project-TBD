import type { EssayDetailDto } from '@apogee/shared/api';
import { Card, CardContent } from '@/components/ui/card';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { formatDate } from '@/lib/format';

export function PromptPanel({ essay, timezone }: { essay: EssayDetailDto; timezone: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{essay.school_name ?? 'Common App personal essay'}</p>
          {essay.due_date ? <DeadlineBadge daysRemaining={essay.days_remaining} label={formatDate(essay.due_date, timezone)} /> : null}
        </div>
        {essay.prompt ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{essay.prompt}</p> : null}
        {essay.word_limit ? <p className="text-xs text-muted-foreground">{essay.word_limit} word limit</p> : null}
      </CardContent>
    </Card>
  );
}
