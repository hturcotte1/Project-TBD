'use client';

import type { ApplicationDto, RecommenderDto } from '@apogee/shared/api';
import type { RecommenderRole } from '@apogee/shared/domain';
import { Check, DotsThree } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { formatDeadlineDate, nearestDeadline } from '@/components/recommenders/recommender-sort';
import { derivePerSchoolStatus, summarizeSchoolStatuses } from '@/components/recommenders/recommender-status';
import {
  Button,
  DaysFigure,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableExpansion,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';
import { HEAT_TEXT_CLASSES } from '@/lib/urgency';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<RecommenderRole, string> = { teacher: 'Teacher', counselor: 'Counselor', other: 'Other' };

export interface RecommendersTableProps {
  recommenders: RecommenderDto[];
  applicationsById: Map<string, ApplicationDto>;
  timezone: string;
  onEdit: (recommender: RecommenderDto) => void;
  onDraftReminder: (recommender: RecommenderDto) => void;
}

export function RecommendersTable({ recommenders, applicationsById, timezone, onEdit, onDraftReminder }: RecommendersTableProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RecommenderDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => clientApi.call('recommenderDelete', { params: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommenders'] });
      toast('Recommender removed.');
    },
    onError: () => toast('Could not remove. Try again.'),
    onSettled: () => setRemoveTarget(null),
  });

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        {/* Below lg the table shows only Name and the day count — two cells that need no column
            labels — so the header row itself is dropped rather than surviving with just "Name"
            in it (the pattern the Schools table already uses). */}
        <TableHead className="hidden lg:table-header-group">
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Schools</TableHeaderCell>
            <TableHeaderCell>Nearest deadline</TableHeaderCell>
            {/* Blank header for the day-count column: it reads off the Deadline header to its
                left, so it needs no label of its own. */}
            <TableHeaderCell className="pl-6" />
            <TableHeaderCell>Last nudged</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recommenders.map((recommender) => {
            const expanded = expandedId === recommender.id;
            const nearest = nearestDeadline(recommender, applicationsById);
            const roleLine = `${ROLE_LABELS[recommender.role]}${recommender.subject ? `, ${recommender.subject}` : ''}`;

            return (
              <Fragment key={recommender.id}>
                <TableRow interactive expanded={expanded} onClick={() => toggleExpand(recommender.id)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{recommender.name}</span>
                      {/* At lg the Schools column carries the status sentence, so this second line
                          is free for the role. Below lg that column is hidden, so the sentence
                          moves here instead — "the fact the page exists for" — and the role moves
                          into the expansion. */}
                      <span className="hidden text-12 text-fg-2 lg:block">{roleLine}</span>
                      <span className="text-12 text-fg-2 lg:hidden">{summarizeSchoolStatuses(recommender.assignments)}</span>
                    </div>
                  </TableCell>
                  <TableCell muted className="hidden lg:table-cell">
                    {summarizeSchoolStatuses(recommender.assignments)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {nearest ? <span className="text-fg">{formatDeadlineDate(nearest.deadline, timezone)}</span> : <span className="text-fg-3">–</span>}
                  </TableCell>
                  {/* Its own column, not appended after the date in the same cell: "Nov 1" and "57"
                      side by side in one cell reads as one number. A right-aligned column with a
                      clear gap from the date keeps them apart, as on the Schools table. */}
                  <TableCell numeric className="hidden pl-6 lg:table-cell">
                    <DaysFigure days={nearest?.daysRemaining ?? null} format="number" />
                  </TableCell>
                  <TableCell muted className="hidden text-fg-3 lg:table-cell">
                    {recommender.last_nudged_at ? relativeTimeFromNow(recommender.last_nudged_at) : 'Never'}
                  </TableCell>
                  <TableCell numeric className="lg:hidden">
                    <DaysFigure days={nearest?.daysRemaining ?? null} format="number" />
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableExpansion colSpan={5}>
                    <div className="flex flex-col gap-4">
                      {/* Below lg the row's second line under the name holds the status sentence
                          instead of the role (the fact the page exists for), so the role surfaces
                          here instead. At lg it's already on the row, so this line is redundant
                          there and stays hidden. */}
                      <span className="text-14 text-fg-2 lg:hidden">{roleLine}</span>
                      <div className="flex flex-col gap-3">
                        {recommender.assignments.length === 0 ? (
                          <p className="text-14 text-fg-2">Not assigned to any school yet.</p>
                        ) : (
                          recommender.assignments.map((assignment) => {
                            const daysRemaining = applicationsById.get(assignment.application_id)?.days_remaining ?? null;
                            const status = derivePerSchoolStatus(assignment, daysRemaining);
                            return (
                              <div key={assignment.id} className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                                <span className="text-14 text-fg">{assignment.school_name}</span>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  {status.tone === 'ok' ? (
                                    <span className="flex items-center gap-1 text-14 text-ok">
                                      <Check /> {status.label}
                                    </span>
                                  ) : (
                                    <span className={cn('text-14', HEAT_TEXT_CLASSES[status.tone])}>{status.label}</span>
                                  )}
                                  <span className="text-12 text-fg-3">{status.lastSeenText}</span>
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <Button variant="text" onClick={() => onDraftReminder(recommender)}>
                          Draft a reminder
                        </Button>
                        <Button variant="text" onClick={() => onEdit(recommender)}>
                          Edit
                        </Button>
                        <Menu>
                          <MenuTrigger asChild>
                            <Button variant="quiet" iconOnly aria-label={`More actions for ${recommender.name}`}>
                              <DotsThree />
                            </Button>
                          </MenuTrigger>
                          <MenuContent align="start">
                            <MenuItem danger onSelect={() => setRemoveTarget(recommender)}>
                              Remove
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </div>
                    </div>
                  </TableExpansion>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={removeTarget !== null} onOpenChange={(next) => !next && setRemoveTarget(null)}>
        <DialogContent>
          <DialogTitle>Remove {removeTarget?.name}</DialogTitle>
          <DialogDescription>
            This removes them from every school they&rsquo;re assigned to here. It does not contact them or change anything on Common App.
          </DialogDescription>
          <DialogActions>
            <Button variant="quiet" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => removeTarget && remove.mutate(removeTarget.id)}>
              Remove
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}
