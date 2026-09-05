'use client';

import type { BrowserJobDto } from '@apogee/shared/api';
import type { BrowserJobKind, BrowserJobStatus } from '@apogee/shared/domain';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 20_000;
const PAGE_SIZE = 100;

const KIND_LABEL: Record<BrowserJobKind, string> = {
  verify_credentials: 'Verify credentials',
  full_sync: 'Full sync',
  fill_fields: 'Fill fields',
  check_recommenders: 'Check recommenders',
};

const STATUS_VARIANT: Record<BrowserJobStatus, BadgeProps['variant']> = {
  queued: 'outline',
  running: 'warn',
  awaiting_verification_code: 'warn',
  succeeded: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
};

const STATUS_LABEL: Record<BrowserJobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  awaiting_verification_code: 'Waiting on a code',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function JobCard({ job }: { job: BrowserJobDto }) {
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{KIND_LABEL[job.kind]}</p>
            <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{relativeTimeFromNow(job.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {job.attempts} attempt{job.attempts === 1 ? '' : 's'} · {job.provider}
        </p>
        {job.error ? <p className="rounded-md border border-urgent-border bg-urgent-bg px-2.5 py-1.5 text-xs text-urgent">{job.error}</p> : null}
        {job.screenshots.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {job.screenshots.map((shot) => (
              <a key={`${shot.page}-${shot.taken_at}`} href={shot.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img src={shot.url} alt={`${job.kind} — ${shot.page}`} className="h-16 w-24 rounded border border-border object-cover" />
              </a>
            ))}
          </div>
        ) : null}
        {job.replay_url ? (
          <a
            href={job.replay_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Replay <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SyncsTab() {
  const query = useQuery({
    queryKey: ['browser-jobs'],
    queryFn: () => clientApi.call('browserJobsList', { query: { limit: PAGE_SIZE } }),
    refetchInterval: POLL_MS,
  });

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load syncs — try refreshing.</p>;
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No syncs yet"
        description="Once Common App is connected, syncs run on a schedule (and any time you ask for one) — each one shows up here with what it found."
      />
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
