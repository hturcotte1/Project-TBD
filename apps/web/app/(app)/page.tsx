'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, Countdown, ErrorNote, PageTitle, Stack } from '@/components/system';
import { CountdownSection } from '@/components/today/countdown-section';
import { formatLongDate } from '@/components/today/format-today';
import { QueueSection } from '@/components/today/queue-section';
import { SinceYesterday } from '@/components/today/since-yesterday';
import { VectorSection } from '@/components/today/vector-section';
import { WaitingOnYou } from '@/components/today/waiting-on-you';
import { clientApi } from '@/lib/api.client';

// React Query pauses `refetchInterval` while the tab is hidden (refetchIntervalInBackground
// defaults to false), which is exactly "poll every 15s while visible".
const POLL_MS = 15_000;
const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_AGENT_NAME = 'Vector';

export default function TodayPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => clientApi.call('settingsGet') });
  const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: () => clientApi.call('overview'), refetchInterval: POLL_MS });
  const applicationsQuery = useQuery({ queryKey: ['applications'], queryFn: () => clientApi.call('applicationsList'), refetchInterval: POLL_MS });
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
    queryKey: ['messages', 'main'],
    queryFn: () => clientApi.call('messagesList', { params: { kind: 'main' } }),
    refetchInterval: POLL_MS,
  });

  const timezone = meQuery.data?.timezone ?? DEFAULT_TIMEZONE;
  const agentName = settingsQuery.data?.agent_name ?? DEFAULT_AGENT_NAME;
  const todayLabel = overviewQuery.data ? formatLongDate(overviewQuery.data.today, timezone) : undefined;

  return (
    <div>
      <PageTitle meta={todayLabel}>Today</PageTitle>
      <Stack className="mt-8">
        {overviewQuery.isError ? (
          <ErrorNote>
            Could not load your overview.{' '}
            <Button variant="text" size="sm" className="h-auto px-0" onClick={() => void overviewQuery.refetch()}>
              Try again
            </Button>
          </ErrorNote>
        ) : overviewQuery.data ? (
          <CountdownSection overview={overviewQuery.data} applications={applicationsQuery.data ?? []} />
        ) : (
          // Same "no deadline" state Countdown already renders elsewhere — keeps the countdown's
          // own numeral on the page (and its font) from the first paint, rather than an empty gap.
          <Countdown size="page" days={null} />
        )}

        {approvalsQuery.data && approvalsQuery.data.length > 0 ? <WaitingOnYou approvals={approvalsQuery.data} /> : null}

        <QueueSection actions={actionsQuery.data} isError={actionsQuery.isError} timezone={timezone} />

        {overviewQuery.data ? <SinceYesterday overview={overviewQuery.data} /> : null}

        {messagesQuery.data ? <VectorSection messages={messagesQuery.data} agentName={agentName} /> : null}
      </Stack>
    </div>
  );
}
