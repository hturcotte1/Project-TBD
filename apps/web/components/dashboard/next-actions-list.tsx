'use client';

import type { NextActionDto } from '@apogee/shared/api';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, ListChecks } from 'lucide-react';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { EmptyState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const SNOOZE_HOURS = 24;

/** How many actions to show before the student asks for the full list. */
const INITIAL_VISIBLE = 8;

export function NextActionsList({ actions }: { actions: NextActionDto[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? actions : actions.slice(0, INITIAL_VISIBLE);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const update = useMutation({
    mutationFn: (input: { id: string; status: 'done' | 'snoozed'; snoozedUntil?: string | null }) =>
      clientApi.call('nextActionUpdate', { params: { id: input.id }, body: { status: input.status, snoozed_until: input.snoozedUntil ?? null } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['next-actions'] });
    },
    onError: () => {
      toast({ title: 'Could not update that action — try again.', variant: 'destructive' });
    },
  });

  if (actions.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nothing pending"
        description="Vector queues up the next concrete step here as soon as there's one to take — after your first sync, or once a new deadline needs attention."
      />
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((action) => (
        <Card key={action.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {action.school_name ? <span className="text-xs font-medium text-muted-foreground">{action.school_name}</span> : null}
                {action.due_date ? <DeadlineBadge daysRemaining={action.days_remaining} /> : null}
              </div>
              <p className="text-sm font-medium">{action.action}</p>
              <p className="text-sm text-muted-foreground">{action.reason}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({ id: action.id, status: 'snoozed', snoozedUntil: new Date(Date.now() + SNOOZE_HOURS * 3_600_000).toISOString() })
                }
              >
                <Clock className="h-3.5 w-3.5" /> Snooze
              </Button>
              <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: action.id, status: 'done' })}>
                <Check className="h-3.5 w-3.5" /> Done
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {actions.length > INITIAL_VISIBLE ? (
        <Button type="button" variant="ghost" className="w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${actions.length}`}
        </Button>
      ) : null}
    </div>
  );
}
