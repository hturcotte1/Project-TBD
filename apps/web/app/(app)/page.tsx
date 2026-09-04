'use client';

import { useQuery } from '@tanstack/react-query';
import { ApprovalsCard } from '@/components/dashboard/approvals-card';
import { ChangesStrip } from '@/components/dashboard/changes-strip';
import { DeadlineHero } from '@/components/dashboard/deadline-hero';
import { MessagesPreview } from '@/components/dashboard/messages-preview';
import { NextActionsList } from '@/components/dashboard/next-actions-list';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

// React Query pauses `refetchInterval` while the tab is hidden (refetchIntervalInBackground
// defaults to false), which is exactly the "poll every 15s while visible" behavior asked for.
const POLL_MS = 15_000;

function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">{message}</p>;
}

export default function TodayPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: () => clientApi.call('overview'), refetchInterval: POLL_MS });
  const actionsQuery = useQuery({
    queryKey: ['next-actions'],
    queryFn: () => clientApi.call('nextActionsList', { query: { include_closed: false } }),
    refetchInterval: POLL_MS,
  });
  const approvalsQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => clientApi.call('approvalsList', { query: { status: 'pending' } }),
    refetchInterval: POLL_MS,
  });
  const messagesQuery = useQuery({
    queryKey: ['messages', 'main', 'recent'],
    queryFn: () => clientApi.call('messagesList', { params: { kind: 'main' } }),
    refetchInterval: POLL_MS,
  });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  return (
    <div className="pb-8">
      <PageHeader title="Today" description="Your next concrete step, in order." />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {overviewQuery.data ? (
          <DeadlineHero overview={overviewQuery.data} timezone={timezone} />
        ) : overviewQuery.isError ? (
          <ErrorNote message="Could not load your overview — try refreshing." />
        ) : (
          <Skeleton className="h-40 w-full" />
        )}

        {overviewQuery.data ? (
          <ChangesStrip changes={overviewQuery.data.changes_since_yesterday} />
        ) : overviewQuery.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : null}

        {approvalsQuery.data ? (
          <ApprovalsCard approvals={approvalsQuery.data} />
        ) : approvalsQuery.isError ? (
          <ErrorNote message="Could not load approvals — try refreshing." />
        ) : (
          <Skeleton className="h-24 w-full" />
        )}

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Next actions</h2>
          {actionsQuery.data ? (
            <NextActionsList actions={actionsQuery.data} />
          ) : actionsQuery.isError ? (
            <ErrorNote message="Could not load next actions — try refreshing." />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </div>

        {messagesQuery.data ? (
          <MessagesPreview messages={messagesQuery.data} />
        ) : messagesQuery.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : null}
      </div>
    </div>
  );
}
