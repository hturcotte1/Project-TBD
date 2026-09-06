'use client';

import type { ApplicationDto, ApplicationItemDto } from '@apogee/shared/api';
import { CaretDown } from '@phosphor-icons/react';
import { Fragment } from 'react';
import { completionByApplication } from '@/components/schools/completion';
import { formatDeadlineDate } from '@/components/schools/format-deadline';
import { DECISION_LABELS, PLAN_LABELS } from '@/components/schools/plan-labels';
import { SchoolExpansion } from '@/components/schools/school-expansion';
import type { SchoolSort, SchoolSortColumn } from '@/components/schools/sort';
import { applicationStatusWord } from '@/components/schools/sync-state';
import { CompletionBar, DaysFigure, OkNote, Table, TableBody, TableCell, TableExpansion, TableHead, TableHeaderCell, TableRow } from '@/components/system';
import { cn } from '@/lib/utils';

// DESIGN.md: Bricolage Grotesque is the countdown numeral "and nothing else... and the small
// numeral in the Schools table" — so just this one DaysFigure instance (the day count in the
// Deadline column) opts into the count face; every other DaysFigure on the page stays in Hanken.
const COUNT_NUMERAL_CLASS = 'font-count font-semibold tracking-[-0.03em] tabular-nums';

export interface SchoolsTableProps {
  applications: ApplicationDto[];
  items: ApplicationItemDto[];
  timezone: string;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  /** Omitted for the Submitted table: the sort headers become plain, non-interactive labels. */
  sort?: SchoolSort;
  onSortChange?: (column: SchoolSortColumn) => void;
  /** Hidden for the Submitted table, which shows the decision word instead. */
  showCompletion?: boolean;
  syncActive: boolean;
  needsCode: boolean;
}

export function SchoolsTable({
  applications,
  items,
  timezone,
  expandedId,
  onToggleExpand,
  sort,
  onSortChange,
  showCompletion = true,
  syncActive,
  needsCode,
}: SchoolsTableProps) {
  const groupsByApplication = completionByApplication(items);
  // One extra column versus the naive count: the Deadline date and its day-count figure are now
  // separate <td>s (see the fix note below), not one cell sharing two pieces of text.
  const columnCount = showCompletion ? 7 : 6;

  function sortDirection(column: SchoolSortColumn) {
    return sort?.column === column ? sort.direction : null;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        {/* Below lg the table shows only School, the day count and the caret — three cells that
            need no column labels — so the header row itself is dropped rather than surviving as a
            near-empty row with just "School" in it. */}
        <TableHead className="hidden lg:table-header-group">
          <TableRow>
            <TableHeaderCell sort={sortDirection('name')} onSort={onSortChange ? () => onSortChange('name') : undefined}>
              School
            </TableHeaderCell>
            <TableHeaderCell sort={sortDirection('deadline')} onSort={onSortChange ? () => onSortChange('deadline') : undefined}>
              Deadline
            </TableHeaderCell>
            {/* Blank header for the day-count column: it reads off the Deadline header to its
                left, and the sort control stays on that one column. */}
            <TableHeaderCell className="pl-6" />
            {showCompletion ? (
              <TableHeaderCell sort={sortDirection('completion')} onSort={onSortChange ? () => onSortChange('completion') : undefined}>
                Completion
              </TableHeaderCell>
            ) : null}
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="w-8" />
          </TableRow>
        </TableHead>
        <TableBody>
          {applications.map((application) => {
            const expanded = expandedId === application.id;
            const groups = groupsByApplication[application.id] ?? [];
            const totalDone = groups.reduce((sum, group) => sum + group.done, 0);
            const totalAll = groups.reduce((sum, group) => sum + group.total, 0);
            const statusWord = showCompletion
              ? applicationStatusWord({ status: application.status, syncActive, needsCode })
              : { text: application.decision ? DECISION_LABELS[application.decision] : 'Submitted', tone: 'muted' as const };
            const appItems = items.filter((item) => item.application_id === application.id);

            return (
              <Fragment key={application.id}>
                <TableRow interactive expanded={expanded} onClick={() => onToggleExpand(application.id)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{application.school.name}</span>
                      <span className="text-12 text-fg-2">{PLAN_LABELS[application.plan]}</span>
                    </div>
                  </TableCell>
                  <TableCell numeric className="lg:hidden">
                    <DaysFigure days={application.days_remaining} format="number" className={COUNT_NUMERAL_CLASS} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-fg">{formatDeadlineDate(application.deadline, timezone)}</span>
                  </TableCell>
                  {/* Its own column, not appended after the date in the same cell: "Nov 1" and "57"
                      side by side in one cell reads as one number ("Nov 1 57"). A right-aligned
                      column with a clear gap from the date keeps them apart. */}
                  <TableCell numeric className="hidden pl-6 lg:table-cell">
                    <DaysFigure days={application.days_remaining} format="number" className={COUNT_NUMERAL_CLASS} />
                  </TableCell>
                  {showCompletion ? (
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <CompletionBar groups={groups} className="w-[160px]" />
                        <span className="whitespace-nowrap text-12 text-fg-2">
                          {totalDone} of {totalAll}
                        </span>
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="hidden lg:table-cell">
                    {statusWord ? (
                      statusWord.tone === 'ok' ? (
                        <OkNote>{statusWord.text}</OkNote>
                      ) : (
                        <span className="text-fg-2">{statusWord.text}</span>
                      )
                    ) : null}
                  </TableCell>
                  <TableCell className="w-8">
                    <CaretDown className={cn('transition-transform duration-fast ease-out', expanded && 'rotate-180')} />
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableExpansion colSpan={columnCount}>
                    <SchoolExpansion application={application} items={appItems} timezone={timezone} />
                  </TableExpansion>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
