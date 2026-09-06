'use client';

import type { ApplicationPlan } from '@apogee/shared/domain';
import { CircleNotch } from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { Button, Countdown, DaysFigure, ErrorNote, Table, TableBody, TableCell, TableRow, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

const PLAN_LABELS: Record<ApplicationPlan, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision II',
  EA: 'Early Action',
  REA: 'Restrictive Early Action',
  RD: 'Regular Decision',
  rolling: 'Rolling',
};

/** Step 7: a single screen with no question — completion kicks off the first sync automatically,
 * and "Go to Today" both retries a failed attempt and, once it succeeds, leaves onboarding. */
export function StepFirstSync({ onboarding }: OnboardingStepProps) {
  const router = useRouter();

  const finish = useMutation({
    mutationFn: async () => {
      await clientApi.call('onboardingStep', { body: { step: 7, data: {} } });
      return clientApi.call('onboardingComplete');
    },
    onError: () => toast('Could not finish setup. Try again in a moment.'),
  });

  const { mutate: startFinishing } = finish;
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

  const deadline = overviewQuery.data?.nearest_deadline;
  const label = deadline ? `days until ${deadline.school_name}, ${PLAN_LABELS[deadline.plan]}.` : undefined;

  function handleGoToToday() {
    if (finish.isError) {
      finish.mutate();
      return;
    }
    if (finish.isSuccess && !syncing) router.push('/');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-22 font-semibold lg:text-28">First sync</h1>
      </div>

      <Countdown size="header" days={deadline?.days_remaining ?? null} label={label} />

      {finish.isError ? (
        <ErrorNote>The first sync did not finish. You can start it again from Schools.</ErrorNote>
      ) : syncing || !finish.isSuccess ? (
        <p className="flex items-center gap-2 text-14 text-fg-2">
          <CircleNotch className="animate-spin" /> Vector is reading your Common App.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-14 text-fg">
            You're set up, {onboarding.student.preferred_name || onboarding.student.first_name}. I just texted you the top 3 things to do first.
          </p>
          {actionsQuery.data && actionsQuery.data.length > 0 ? (
            <Table>
              <TableBody>
                {actionsQuery.data.slice(0, 3).map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="font-medium">{action.action}</div>
                      {action.school_name ? <div className="text-12 text-fg-2">{action.school_name}</div> : null}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {action.days_remaining === null ? null : <DaysFigure days={action.days_remaining} format="relative" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="primary" onClick={handleGoToToday} loading={finish.isPending || syncing} disabled={!finish.isError && (!finish.isSuccess || syncing)}>
          Go to Today
        </Button>
      </div>
    </div>
  );
}
