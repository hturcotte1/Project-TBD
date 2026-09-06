'use client';

import type { AdminStudentDto } from '@apogee/shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorNote, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;

function SyncNowButton({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const syncNow = useMutation({
    mutationFn: () => clientApi.call('adminSyncNow', { params: { id: studentId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast('Sync queued.');
    },
    onError: () => toast('Could not queue a sync. Try again.'),
  });
  return (
    <Button variant="text" size="sm" loading={syncNow.isPending} onClick={() => syncNow.mutate()}>
      Sync now
    </Button>
  );
}

function lastJobWord(row: AdminStudentDto) {
  if (!row.last_job_status) return <span className="text-fg-3">–</span>;
  if (row.last_job_status === 'succeeded') return <span className="text-ok">Succeeded</span>;
  if (row.last_job_status === 'failed') return <span className="text-err">Failed</span>;
  return <span className="text-fg-2">{row.last_job_status.replace(/_/g, ' ')}</span>;
}

export function StudentsTable() {
  const query = useQuery({ queryKey: ['admin', 'students'], queryFn: () => clientApi.call('adminStudents'), refetchInterval: POLL_MS });

  if (query.isError) {
    return (
      <ErrorNote>
        Could not load students.{' '}
        <Button variant="text" className="h-auto px-0" onClick={() => query.refetch()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }
  if (!query.data) return null;
  if (query.data.length === 0) return <Empty sentence="No students yet. Students appear here once they finish onboarding." />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Schools</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Open items</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Last synced</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Last job</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Failed 24h</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Tokens 30d</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Browser min</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.map((row) => (
            <TableRow key={row.student.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {row.student.preferred_name || row.student.first_name} {row.student.last_name}
                  </span>
                  <span className="text-12 text-fg-2">{row.student.email}</span>
                </div>
              </TableCell>
              <TableCell numeric muted className="hidden lg:table-cell">
                {row.applications_count}
              </TableCell>
              <TableCell numeric muted className="hidden lg:table-cell">
                {row.open_items}
              </TableCell>
              <TableCell muted className="hidden lg:table-cell">
                {row.last_synced_at ? relativeTimeFromNow(row.last_synced_at) : 'never'}
              </TableCell>
              <TableCell className="hidden text-12 lg:table-cell">{lastJobWord(row)}</TableCell>
              <TableCell numeric className={row.failed_jobs_24h > 0 ? 'hidden text-err lg:table-cell' : 'hidden text-fg-2 lg:table-cell'}>
                {row.failed_jobs_24h}
              </TableCell>
              <TableCell numeric muted className="hidden text-12 lg:table-cell">
                {(row.tokens_30d.input + row.tokens_30d.output).toLocaleString()}
              </TableCell>
              <TableCell numeric muted className="hidden text-12 lg:table-cell">
                {row.browser_minutes_30d.toFixed(1)}
              </TableCell>
              <TableCell>
                <SyncNowButton studentId={row.student.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
