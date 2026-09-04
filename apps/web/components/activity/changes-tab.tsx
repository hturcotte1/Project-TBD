'use client';

import type { SnapshotSummaryDto } from '@tbd/shared/api';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, History } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import { formatDateTime } from '@/lib/format';

const POLL_MS = 20_000;
const PAGE_SIZE = 100;

const SIGNIFICANCE_VARIANT = { important: 'warn', notable: 'secondary', info: 'outline' } as const;

function SnapshotCard({ snapshot, timezone }: { snapshot: SnapshotSummaryDto; timezone: string }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <p className="text-sm font-medium">{formatDateTime(snapshot.created_at, timezone)}</p>
        <span className="text-xs text-muted-foreground">{Math.round(snapshot.overall_confidence * 100)}% confidence</span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {snapshot.low_confidence_sections.length > 0 ? (
          <p className="flex items-start gap-1.5 rounded-md border border-warn-border bg-warn-bg px-2.5 py-1.5 text-xs text-warn">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Low confidence reading: {snapshot.low_confidence_sections.join(', ')} — worth double-checking on Common App directly.
          </p>
        ) : null}
        {snapshot.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing changed in this sync.</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.changes.map((change, index) => (
              <li key={`${change.kind}-${change.path}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5 text-sm">
                <div className="min-w-0">
                  {change.school_name ? <p className="text-xs font-medium text-muted-foreground">{change.school_name}</p> : null}
                  <p>{change.summary}</p>
                </div>
                <Badge variant={SIGNIFICANCE_VARIANT[change.significance]} className="shrink-0">
                  {change.significance}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ChangesTab({ timezone }: { timezone: string }) {
  const query = useQuery({
    queryKey: ['snapshots'],
    queryFn: () => clientApi.call('snapshotsList', { query: { limit: PAGE_SIZE } }),
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
    return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load sync history — try refreshing.</p>;
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No syncs recorded yet"
        description="Once the first sync runs, every change it finds on Common App — new sections, status flips, recommender updates — lands here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((snapshot) => (
        <SnapshotCard key={snapshot.id} snapshot={snapshot} timezone={timezone} />
      ))}
    </div>
  );
}
