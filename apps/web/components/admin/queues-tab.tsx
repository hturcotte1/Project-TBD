'use client';

import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 15_000;

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-semibold tabular-nums ${warn && value > 0 ? 'text-destructive' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function QueuesTab() {
  const query = useQuery({ queryKey: ['admin', 'queues'], queryFn: () => clientApi.call('adminQueues'), refetchInterval: POLL_MS });

  if (query.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (query.isError) return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load queue health — try refreshing.</p>;
  if (query.data.length === 0) return <EmptyState icon={Gauge} title="No queues reporting" description="Queue health appears here once the worker has processed at least one job." />;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {query.data.map((q) => (
        <Card key={q.queue}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium capitalize">{q.queue}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2 pt-0 text-center">
            <Stat label="Waiting" value={q.waiting} />
            <Stat label="Active" value={q.active} />
            <Stat label="Delayed" value={q.delayed} />
            <Stat label="Failed" value={q.failed} warn />
            <Stat label="Completed" value={q.completed} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
