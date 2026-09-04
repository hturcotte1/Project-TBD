'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;

export function DriftTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['admin', 'drift'], queryFn: () => clientApi.call('adminDrift'), refetchInterval: POLL_MS });

  const resolve = useMutation({
    mutationFn: (id: string) => clientApi.call('adminDriftResolve', { params: { id }, body: { status: 'resolved' } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'drift'] });
      toast({ title: 'Marked resolved' });
    },
    onError: () => toast({ title: 'Could not resolve — try again.', variant: 'destructive' }),
  });

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (query.isError) return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load site drift — try refreshing.</p>;
  if (query.data.length === 0) return <EmptyState icon={AlertTriangle} title="No drift detected" description="When Common App's page structure changes enough to lower extraction confidence, it shows up here." />;

  return (
    <div className="space-y-3">
      {query.data.map((alert) => (
        <Card key={alert.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{alert.section}</p>
                <Badge variant={alert.status === 'open' ? 'warn' : 'success'}>{alert.status}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(alert.confidence * 100)}% confidence · {relativeTimeFromNow(alert.created_at)}
              </span>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{JSON.stringify(alert.details, null, 2)}</pre>
            {alert.status === 'open' ? (
              <Button type="button" variant="outline" size="sm" loading={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>
                Mark resolved
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
