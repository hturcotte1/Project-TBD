'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;
const PAGE_SIZE = 100;

export function JobsTab() {
  const query = useQuery({
    queryKey: ['admin', 'jobs', 'failed'],
    queryFn: () => clientApi.call('adminJobs', { query: { status: 'failed', limit: PAGE_SIZE } }),
    refetchInterval: POLL_MS,
  });

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (query.isError) return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load failed jobs — try refreshing.</p>;
  if (query.data.length === 0) return <EmptyState icon={AlertOctagon} title="No failed jobs" description="Every browser job across every student has been succeeding or is still in flight." />;

  return (
    <div className="space-y-3">
      {query.data.map((job) => (
        <Card key={job.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {job.kind} — student {job.student_id.slice(0, 8)}
              </p>
              <span className="text-xs text-muted-foreground">
                {relativeTimeFromNow(job.created_at)} · {job.attempts} attempt{job.attempts === 1 ? '' : 's'}
              </span>
            </div>
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
      ))}
    </div>
  );
}
