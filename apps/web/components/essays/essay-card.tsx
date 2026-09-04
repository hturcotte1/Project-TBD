'use client';

import type { EssayDto } from '@tbd/shared/api';
import type { ItemStatus } from '@tbd/shared/domain';
import Link from 'next/link';
import { useState } from 'react';
import { wordCountLabel, wordProgressPercent } from '@/components/essays/word-count';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatDate, relativeTimeFromNow } from '@/lib/format';

const STATUS_LABELS: Record<ItemStatus, string> = {
  missing: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  not_applicable: 'N/A',
  blocked: 'Blocked',
};

const STATUS_VARIANT: Record<ItemStatus, 'outline' | 'secondary' | 'success' | 'urgent'> = {
  missing: 'outline',
  in_progress: 'secondary',
  done: 'success',
  not_applicable: 'outline',
  blocked: 'urgent',
};

const PROMPT_PREVIEW_LENGTH = 160;

export function EssayCard({ essay, timezone }: { essay: EssayDto; timezone: string }) {
  const [expanded, setExpanded] = useState(false);
  const percent = wordProgressPercent(essay.current_word_count, essay.word_limit);
  const isLong = essay.prompt.length > PROMPT_PREVIEW_LENGTH;
  const promptText = expanded || !isLong ? essay.prompt : `${essay.prompt.slice(0, PROMPT_PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <Link href={`/essays/${essay.id}`} className="text-sm font-semibold hover:underline">
              {essay.title}
            </Link>
            <p className="text-xs text-muted-foreground">{essay.school_name ?? 'Common App personal essay'}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {essay.due_date ? <DeadlineBadge daysRemaining={essay.days_remaining} label={formatDate(essay.due_date, timezone)} /> : null}
            {essay.status ? <Badge variant={STATUS_VARIANT[essay.status]}>{STATUS_LABELS[essay.status]}</Badge> : null}
          </div>
        </div>

        {essay.prompt ? (
          <p className="text-sm text-muted-foreground">
            {promptText}{' '}
            {isLong ? (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="font-medium text-primary hover:underline">
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </p>
        ) : null}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{wordCountLabel(essay.current_word_count, essay.word_limit)}</span>
          </div>
          {percent !== null ? <Progress value={percent} className="h-1.5" /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {essay.draft_count} draft{essay.draft_count === 1 ? '' : 's'}
          </span>
          <span>{essay.feedback_count} feedback round{essay.feedback_count === 1 ? '' : 's'}</span>
          <span>{essay.last_edited_at ? `edited ${relativeTimeFromNow(essay.last_edited_at)}` : 'not started'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
