'use client';

import type { AdminStudentDto } from '@apogee/shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Users } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;

function SyncNowButton({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const syncNow = useMutation({
    mutationFn: () => clientApi.call('adminSyncNow', { params: { id: studentId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast({ title: 'Sync queued' });
    },
    onError: () => toast({ title: 'Could not queue a sync — try again.', variant: 'destructive' }),
  });
  return (
    <Button type="button" variant="outline" size="sm" loading={syncNow.isPending} onClick={() => syncNow.mutate()}>
      <RefreshCw className="h-3.5 w-3.5" /> Run sync now
    </Button>
  );
}

function StudentRow({ row }: { row: AdminStudentDto }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-2">
        <p className="font-medium">{row.student.preferred_name || row.student.first_name} {row.student.last_name}</p>
        <p className="text-xs text-muted-foreground">{row.student.email}</p>
      </td>
      <td className="px-3 py-2 text-center tabular-nums">{row.applications_count}</td>
      <td className="px-3 py-2 text-center tabular-nums">{row.open_items}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.last_synced_at ? relativeTimeFromNow(row.last_synced_at) : 'never'}</td>
      <td className="px-3 py-2">{row.last_job_status ? <Badge variant={row.last_job_status === 'succeeded' ? 'success' : row.last_job_status === 'failed' ? 'destructive' : 'outline'}>{row.last_job_status}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
      <td className="px-3 py-2 text-center tabular-nums">{row.failed_jobs_24h > 0 ? <span className="text-destructive">{row.failed_jobs_24h}</span> : row.failed_jobs_24h}</td>
      <td className="px-3 py-2 text-center tabular-nums text-xs text-muted-foreground">
        {(row.tokens_30d.input + row.tokens_30d.output).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-center tabular-nums text-xs text-muted-foreground">{row.browser_minutes_30d.toFixed(1)}</td>
      <td className="px-3 py-2">
        <SyncNowButton studentId={row.student.id} />
      </td>
    </tr>
  );
}

export function StudentsTab() {
  const query = useQuery({ queryKey: ['admin', 'students'], queryFn: () => clientApi.call('adminStudents'), refetchInterval: POLL_MS });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load students — try refreshing.</p>;
  if (query.data.length === 0) return <EmptyState icon={Users} title="No students yet" description="Students appear here once they sign up and complete onboarding." />;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Student</th>
            <th className="px-3 py-2 text-center font-medium">Apps</th>
            <th className="px-3 py-2 text-center font-medium">Open items</th>
            <th className="px-3 py-2 font-medium">Last sync</th>
            <th className="px-3 py-2 font-medium">Last job</th>
            <th className="px-3 py-2 text-center font-medium">Failed 24h</th>
            <th className="px-3 py-2 text-center font-medium">Tokens 30d</th>
            <th className="px-3 py-2 text-center font-medium">Browser min 30d</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {query.data.map((row) => (
            <StudentRow key={row.student.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
