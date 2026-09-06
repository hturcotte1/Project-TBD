'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NextActionDto } from '@apogee/shared/api';
import { Button, Empty, ErrorNote, Kbd, Section, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { QueueTable } from './queue-table';
import { resolveActionHref } from './queue-reducer';
import { prefersReducedMotion } from './reduced-motion';
import { computeSnoozeUntil } from './snooze';

const VISIBLE_COUNT = 8;
const FADE_MS = 200; // matches --dur-open in tokens.css

export interface QueueSectionProps {
  actions: NextActionDto[] | undefined;
  isError: boolean;
  timezone: string;
}

/** "Queue": the next concrete steps, in order, with j/k/e/s keyboard control. */
export function QueueSection({ actions, isError, timezone }: QueueSectionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  const update = useMutation({
    mutationFn: (input: { id: string; status: 'done' | 'snoozed'; snoozedUntil?: string | null }) =>
      clientApi.call('nextActionUpdate', { params: { id: input.id }, body: { status: input.status, snoozed_until: input.snoozedUntil ?? null } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['next-actions'] }),
    onError: () => toast('Could not update that action. Try again.'),
  });

  const syncNow = useMutation({
    mutationFn: () => clientApi.call('syncRun'),
    onSuccess: () => toast('Sync started.'),
  });

  function handleOpen(action: NextActionDto) {
    const href = resolveActionHref(action);
    if (href) router.push(href);
  }

  function handleDone(action: NextActionDto) {
    if (prefersReducedMotion()) {
      update.mutate({ id: action.id, status: 'done' });
      toast('Done.');
      return;
    }
    setLeavingIds((current) => new Set(current).add(action.id));
    window.setTimeout(() => {
      update.mutate({ id: action.id, status: 'done' });
      toast('Done.');
    }, FADE_MS);
  }

  function handleSnooze(action: NextActionDto, daysFromNow: number) {
    update.mutate({ id: action.id, status: 'snoozed', snoozedUntil: computeSnoozeUntil(new Date(), timezone, daysFromNow) });
  }

  if (isError) {
    return (
      <Section title="Queue">
        <ErrorNote>Could not load your queue.</ErrorNote>
      </Section>
    );
  }

  if (!actions) return null;

  if (actions.length === 0) {
    return (
      <Section title="Queue">
        <Empty
          sentence="Nothing to do right now. Vector adds the next step here after each sync."
          action={{ label: 'Sync now', onClick: () => syncNow.mutate() }}
        />
      </Section>
    );
  }

  const visible = showAll ? actions : actions.slice(0, VISIBLE_COUNT);

  return (
    <Section title="Queue">
      <div className="flex flex-col gap-3">
        <QueueTable actions={visible} onOpen={handleOpen} onDone={handleDone} onSnooze={handleSnooze} leavingIds={leavingIds} />
        {actions.length > VISIBLE_COUNT ? (
          <Button variant="text" size="sm" className="h-auto self-start px-0" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer' : `Show all ${actions.length}`}
          </Button>
        ) : null}
        <p className="hidden text-12 text-fg-3 lg:block">
          <Kbd>j</Kbd> and <Kbd>k</Kbd> to move, <Kbd>e</Kbd> to open, <Kbd>s</Kbd> to snooze.
        </p>
      </div>
    </Section>
  );
}
