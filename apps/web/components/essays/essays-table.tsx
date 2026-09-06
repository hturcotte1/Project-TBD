'use client';

import type { EssayDto } from '@apogee/shared/api';
import { useRouter } from 'next/navigation';
import { formatDueDate } from '@/components/essays/format';
import { wordGaugeStep, wordsTableLabel } from '@/components/essays/word-count';
import { DaysFigure, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/system';
import { relativeTimeFromNow } from '@/lib/format';
import { HEAT_TEXT_CLASSES } from '@/lib/urgency';
import { cn } from '@/lib/utils';

/** "Not started" / "Drafting" / "Done" — independent of the checklist item's own status word,
 * since an essay can be "in_progress" on the checklist while this table cares only about whether
 * there's a draft yet and whether the student has marked it done. */
function essayStatusWord(essay: EssayDto): { text: string; done: boolean } {
  if (essay.status === 'done') return { text: 'Done', done: true };
  if (essay.current_word_count === 0) return { text: 'Not started', done: false };
  return { text: 'Drafting', done: false };
}

function wordsClassName(essay: EssayDto): string {
  return essay.word_limit !== null ? HEAT_TEXT_CLASSES[wordGaugeStep(essay.current_word_count, essay.word_limit)] : 'text-fg-2';
}

export function EssaysTable({ essays, timezone }: { essays: EssayDto[]; timezone: string }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Essay</TableHeaderCell>
            <TableHeaderCell className="lg:hidden" />
            <TableHeaderCell className="hidden lg:table-cell">Due</TableHeaderCell>
            {/* Blank header for the day-count column: it reads off the Due header to its left, same
                pattern as Schools — a separate right-aligned column, not the date and day count
                sharing one cell ("Nov 1 57" reads as one number). */}
            <TableHeaderCell className="hidden pl-6 lg:table-cell" />
            <TableHeaderCell className="hidden lg:table-cell">Words</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Status</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Edited</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {essays.map((essay) => {
            const status = essayStatusWord(essay);
            return (
              <TableRow key={essay.id} interactive onClick={() => router.push(`/essays/${essay.id}`)}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{essay.title}</span>
                    <span className="text-12 text-fg-2">{essay.school_name ?? 'Personal essay, every school'}</span>
                    <span className={cn('text-12 tabular-nums lg:hidden', wordsClassName(essay))}>{wordsTableLabel(essay.current_word_count, essay.word_limit)}</span>
                  </div>
                </TableCell>
                <TableCell numeric className="lg:hidden">
                  <DaysFigure days={essay.days_remaining} format="number" />
                </TableCell>
                <TableCell className="hidden whitespace-nowrap lg:table-cell">
                  {essay.due_date ? <span className="text-fg">{formatDueDate(essay.due_date, timezone)}</span> : <span className="text-fg-3">No due date</span>}
                </TableCell>
                {/* Its own column, not appended after the date in the same cell (see the header
                    comment above). Empty, not "—", when there's no due date to count down to. */}
                <TableCell numeric className="hidden pl-6 lg:table-cell">
                  {essay.due_date ? <DaysFigure days={essay.days_remaining} format="number" /> : null}
                </TableCell>
                <TableCell numeric className={cn('hidden tabular-nums lg:table-cell', wordsClassName(essay))}>
                  {wordsTableLabel(essay.current_word_count, essay.word_limit)}
                </TableCell>
                <TableCell className={cn('hidden lg:table-cell', status.done ? 'text-ok' : 'text-fg-2')}>{status.text}</TableCell>
                <TableCell className="hidden text-fg-3 lg:table-cell">{essay.last_edited_at ? relativeTimeFromNow(essay.last_edited_at) : 'Never'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
