'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import type { NextActionDto } from '@apogee/shared/api';
import { Button, DaysFigure, Menu, MenuContent, MenuItem, MenuTrigger, Table, TableBody, TableCell, TableRow } from '@/components/system';
import { isTypingContext } from '@/components/shell/keyboard';
import { cn } from '@/lib/utils';
import { tidyNextActionText } from './next-action-text';
import { moveQueueSelection } from './queue-reducer';

export interface QueueTableProps {
  actions: NextActionDto[];
  onOpen: (action: NextActionDto) => void;
  onDone: (action: NextActionDto) => void;
  onSnooze: (action: NextActionDto, daysFromNow: number) => void;
  /** Ids mid fade-out after "Done" — still rendered so the leave animation can play. */
  leavingIds?: Set<string>;
}

function rowElementId(index: number): string {
  return `queue-row-${index}`;
}

/** The queue's rows plus its j/k/e/s keyboard navigation. A no-header Table: rank, action (with
 * its reason as a second line on desktop), school (desktop only), the days figure, and the row's
 * actions — a hover-revealed Done/Snooze pair at lg and up, collapsed to a single icon-only
 * "Actions for …" menu below lg so the action sentence keeps the width. */
export function QueueTable({ actions, onOpen, onDone, onSnooze, leavingIds }: QueueTableProps) {
  const [selected, setSelected] = useState<number | null>(actions.length > 0 ? 0 : null);

  // Keep the selection in range as the list changes shape (an action leaves, "show all" reveals
  // more rows) without resetting it on every render.
  useEffect(() => {
    setSelected((current) => {
      if (actions.length === 0) return null;
      if (current === null) return 0;
      return Math.min(current, actions.length - 1);
    });
  }, [actions.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingContext(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === 'j' || key === 'k') {
        event.preventDefault();
        setSelected((current) => {
          const next = moveQueueSelection(current, key === 'j' ? 1 : -1, actions.length);
          if (next !== null) document.getElementById(rowElementId(next))?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        return;
      }

      if (selected === null) return;
      const action = actions[selected];
      if (!action) return;

      if (key === 'e' || event.key === 'Enter') {
        event.preventDefault();
        onOpen(action);
      } else if (key === 's') {
        event.preventDefault();
        onSnooze(action, 1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, selected, onOpen, onSnooze]);

  return (
    <Table>
      <TableBody>
        {actions.map((action, index) => (
          <TableRow
            key={action.id}
            id={rowElementId(index)}
            interactive
            selected={selected === index}
            className={cn('group', leavingIds?.has(action.id) && 'animate-fade-in [animation-direction:reverse]')}
            onClick={() => setSelected(index)}
          >
            <TableCell muted className="w-[28px] tabular-nums">
              {index + 1}
            </TableCell>
            <TableCell>
              <div className="font-medium">{tidyNextActionText(action.action)}</div>
              <div className="hidden text-12 text-fg-2 lg:block">{tidyNextActionText(action.reason)}</div>
            </TableCell>
            <TableCell muted className="hidden lg:table-cell">
              {action.school_name}
            </TableCell>
            <TableCell numeric>{action.days_remaining === null ? null : <DaysFigure days={action.days_remaining} format="number" />}</TableCell>
            <TableCell>
              <div className="hidden items-center justify-end gap-3 lg:flex lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    onDone(action);
                  }}
                >
                  Done
                </Button>
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="quiet" size="sm" onClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}>
                      Snooze
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem onSelect={() => onSnooze(action, 1)}>Until tomorrow</MenuItem>
                    <MenuItem onSelect={() => onSnooze(action, 3)}>Three days</MenuItem>
                    <MenuItem onSelect={() => onSnooze(action, 7)}>A week</MenuItem>
                  </MenuContent>
                </Menu>
              </div>
              <div className="flex justify-end lg:hidden">
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      variant="quiet"
                      size="sm"
                      iconOnly
                      aria-label={`Actions for ${tidyNextActionText(action.action)}`}
                      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}
                    >
                      <DotsThree size={20} />
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem onSelect={() => onDone(action)}>Done</MenuItem>
                    <MenuItem onSelect={() => onSnooze(action, 1)}>Snooze until tomorrow</MenuItem>
                    <MenuItem onSelect={() => onSnooze(action, 3)}>Snooze three days</MenuItem>
                    <MenuItem onSelect={() => onSnooze(action, 7)}>Snooze a week</MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
