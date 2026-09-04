'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { relativeDays } from '@/lib/format';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

export function StepFirstSync({ onboarding }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();

  const finish = useMutation({
    mutationFn: async () => {
      await clientApi.call('onboardingStep', { body: { step: 7, data: {} } });
      return clientApi.call('onboardingComplete');
    },
    onError: () => toast({ title: 'Could not finish setup', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  const { mutate: startFinishing } = finish;
  // Runs once on mount — kicks off completion + first sync as soon as the student lands here.
  useEffect(() => {
    startFinishing();
  }, [startFinishing]);

  const syncStatusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => clientApi.call('syncStatus'),
    enabled: finish.isSuccess,
    refetchInterval: (query) => {
      const s = query.state.data;
      if (!s) return 2000;
      if (s.last_job && ACTIVE_JOB_STATUSES.has(s.last_job.status)) return 2000;
      return false;
    },
  });

  const syncing = finish.isSuccess && (!syncStatusQuery.data || (syncStatusQuery.data.last_job !== null && ACTIVE_JOB_STATUSES.has(syncStatusQuery.data.last_job.status)));

  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => clientApi.call('overview'),
    enabled: finish.isSuccess && !syncing,
  });

  const actionsQuery = useQuery({
    queryKey: ['next-actions'],
    queryFn: () => clientApi.call('nextActionsList', { query: { include_closed: false } }),
    enabled: finish.isSuccess && !syncing,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">First sync</h1>
        <p className="text-sm text-muted-foreground">Remy is reading your Common App account and building your plan.</p>
      </div>

      {finish.isError ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-destructive">Something went wrong finishing setup.</p>
          <Button type="button" onClick={() => finish.mutate()} loading={finish.isPending}>
            Try again
          </Button>
        </div>
      ) : !finish.isSuccess ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Setting things up…</p>
        </div>
      ) : syncing ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Syncing your Common App account — this usually takes under a minute.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-6 text-center">
            <PartyPopper className="h-6 w-6 text-success" />
            <p className="text-sm font-medium">You&rsquo;re set up, {onboarding.student.preferred_name || onboarding.student.first_name}.</p>
            <p className="text-sm text-muted-foreground">I just texted you the top 3 things to do first — check your phone.</p>
          </div>

          {overviewQuery.data?.nearest_deadline ? (
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nearest deadline</p>
                  <p className="text-sm font-medium">{overviewQuery.data.nearest_deadline.school_name}</p>
                </div>
                <DeadlineBadge daysRemaining={overviewQuery.data.nearest_deadline.days_remaining} />
              </CardContent>
            </Card>
          ) : null}

          {actionsQuery.data && actionsQuery.data.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Top next actions</p>
              {actionsQuery.data.slice(0, 3).map((action) => (
                <Card key={action.id}>
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {action.school_name ? <span>{action.school_name}</span> : null}
                      {action.days_remaining !== null ? <span>· {relativeDays(action.days_remaining)}</span> : null}
                    </div>
                    <p className="text-sm font-medium">{action.action}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Button type="button" className="w-full" onClick={() => router.push('/')}>
            <CheckCircle2 className="h-4 w-4" /> Go to my dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
