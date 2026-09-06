'use client';

import type { ApplicationItemDto } from '@apogee/shared/api';
import type { ItemStatus } from '@apogee/shared/domain';
import { daysUntil } from '@apogee/shared/time';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DotsThree } from '@phosphor-icons/react';
import { Fragment, useState } from 'react';
import {
  Button,
  Checkbox,
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
  TableRow,
  TextLink,
  toast,
} from '@/components/system';
import { ITEM_STATUS_WORDS } from '@/components/schools/plan-labels';
import { NotesDrawer } from '@/components/schools/notes-drawer';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const REC_KINDS = new Set<ApplicationItemDto['kind']>(['teacher_rec', 'counselor_rec', 'other_rec']);

function itemLinkHref(item: ApplicationItemDto): string | null {
  if (item.essay_id) return `/essays/${item.essay_id}`;
  if (item.recommender_id || REC_KINDS.has(item.kind)) return '/recommenders';
  return null;
}

const COLUMN_COUNT = 5;

/** One checklist group's items as a headerless table: a Checkbox for done/not-done, the title
 * (linked to its essay or the recommenders page when applicable), a relative due date, the status
 * word for anything that isn't simply done or missing, and a per-row Menu. Row click expands to
 * the description, evidence and note. */
export function ChecklistTable({ items, timezone, now = new Date() }: { items: ApplicationItemDto[]; timezone: string; now?: Date }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteItem, setNoteItem] = useState<ApplicationItemDto | null>(null);
  const [deleteItem, setDeleteItem] = useState<ApplicationItemDto | null>(null);

  function invalidate(applicationId: string | null) {
    if (applicationId) void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) => clientApi.call('itemUpdate', { params: { id }, body: { status } }),
    onSuccess: (_result, variables) => {
      invalidate(items.find((item) => item.id === variables.id)?.application_id ?? null);
    },
    onError: () => toast('Could not update that item. Try again in a moment.'),
  });

  const saveNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => clientApi.call('itemUpdate', { params: { id }, body: { notes } }),
    onSuccess: (_result, variables) => {
      invalidate(items.find((item) => item.id === variables.id)?.application_id ?? null);
      setNoteItem(null);
    },
    onError: () => toast('Could not save that note. Try again in a moment.'),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => clientApi.call('itemDelete', { params: { id } }),
    onSuccess: (_result, id) => {
      invalidate(items.find((item) => item.id === id)?.application_id ?? null);
      toast('Item removed.');
      setDeleteItem(null);
    },
    onError: () => toast('Could not remove that item. Try again in a moment.'),
  });

  function toggleDone(item: ApplicationItemDto) {
    const next: ItemStatus = item.status === 'done' ? 'missing' : 'done';
    updateStatus.mutate({ id: item.id, status: next }, { onSuccess: () => toast(next === 'done' ? 'Done.' : 'Reopened.') });
  }

  function toggleApplicable(item: ApplicationItemDto) {
    const next: ItemStatus = item.status === 'not_applicable' ? 'missing' : 'not_applicable';
    updateStatus.mutate({ id: item.id, status: next });
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableBody>
            {items.map((item) => {
              const linkHref = itemLinkHref(item);
              const statusWord = ITEM_STATUS_WORDS[item.status];
              const daysRemaining = item.due_date ? daysUntil(item.due_date, now, timezone) : null;
              const expanded = expandedId === item.id;
              const hasExpansion = Boolean(item.description || item.evidence || item.notes);

              return (
                <Fragment key={item.id}>
                  <TableRow
                    interactive={hasExpansion}
                    expanded={hasExpansion ? expanded : undefined}
                    onClick={hasExpansion ? () => setExpandedId(expanded ? null : item.id) : undefined}
                  >
                    <TableCell className="w-8">
                      <Checkbox
                        checked={item.status === 'done'}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleDone(item)}
                        aria-label={item.status === 'done' ? `Reopen "${item.title}"` : `Mark "${item.title}" done`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {linkHref ? (
                        <TextLink href={linkHref} onClick={(event) => event.stopPropagation()}>
                          {item.title}
                        </TextLink>
                      ) : (
                        item.title
                      )}
                    </TableCell>
                    <TableCell numeric>{daysRemaining !== null ? <DaysFigure days={daysRemaining} format="relative" /> : null}</TableCell>
                    <TableCell muted>{statusWord}</TableCell>
                    <TableCell className="w-8" onClick={(event) => event.stopPropagation()}>
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="quiet" iconOnly aria-label={`More actions for "${item.title}"`}>
                            <DotsThree />
                          </Button>
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuItem onSelect={() => toggleApplicable(item)}>
                            {item.status === 'not_applicable' ? 'Mark applicable' : 'Mark not applicable'}
                          </MenuItem>
                          <MenuItem onSelect={() => setNoteItem(item)}>Add a note</MenuItem>
                          {item.source === 'student' ? (
                            <MenuItem danger onSelect={() => setDeleteItem(item)}>
                              Delete
                            </MenuItem>
                          ) : null}
                        </MenuContent>
                      </Menu>
                    </TableCell>
                  </TableRow>
                  {expanded && hasExpansion ? (
                    <TableExpansion colSpan={COLUMN_COUNT}>
                      <div className="flex flex-col gap-2">
                        {item.description ? <p className="text-14 text-fg-2">{item.description}</p> : null}
                        {item.evidence ? (
                          <p className="text-12 text-fg-3">
                            Seen on Common App {relativeTimeFromNow(item.evidence.seen_at, now)}: {item.evidence.text}
                            {item.evidence.source_url ? (
                              <>
                                {' '}
                                <TextLink href={item.evidence.source_url} target="_blank" rel="noreferrer noopener">
                                  Open
                                </TextLink>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                        {item.notes ? <p className="text-14 text-fg">{item.notes}</p> : null}
                      </div>
                    </TableExpansion>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {noteItem ? (
        <NotesDrawer
          open={noteItem !== null}
          onOpenChange={(next) => {
            if (!next) setNoteItem(null);
          }}
          title={noteItem.title}
          notes={noteItem.notes}
          saving={saveNotes.isPending}
          onSave={(notes) => saveNotes.mutate({ id: noteItem.id, notes })}
        />
      ) : null}

      <Dialog open={deleteItem !== null} onOpenChange={(next) => (!next ? setDeleteItem(null) : undefined)}>
        <DialogContent>
          <DialogTitle>Delete &ldquo;{deleteItem?.title}&rdquo;?</DialogTitle>
          <DialogDescription>This removes it from your checklist for good.</DialogDescription>
          <DialogActions>
            <Button variant="quiet" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={removeItem.isPending} onClick={() => deleteItem && removeItem.mutate(deleteItem.id)}>
              Delete
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}
