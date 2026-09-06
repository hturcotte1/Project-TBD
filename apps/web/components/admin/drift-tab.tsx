'use client';

import type { DriftAlertDto } from '@apogee/shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorNote, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;

function ResolveActions({ alert }: { alert: DriftAlertDto }) {
  const queryClient = useQueryClient();
  const resolve = useMutation({
    mutationFn: () => clientApi.call('adminDriftResolve', { params: { id: alert.id }, body: { status: 'resolved' } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'drift'] });
      toast('Marked resolved.');
    },
    onError: () => toast('Could not resolve. Try again.'),
  });

  if (alert.status !== 'open') return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="text" size="sm" loading={resolve.isPending} onClick={() => resolve.mutate()}>
        Resolve
      </Button>
      <Button variant="quiet" size="sm" loading={resolve.isPending} onClick={() => resolve.mutate()}>
        Ignore
      </Button>
    </div>
  );
}

export function DriftTab() {
  const query = useQuery({ queryKey: ['admin', 'drift'], queryFn: () => clientApi.call('adminDrift'), refetchInterval: POLL_MS });

  if (query.isError) {
    return (
      <ErrorNote>
        Could not load site drift.{' '}
        <Button variant="text" className="h-auto px-0" onClick={() => query.refetch()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }
  if (!query.data) return null;
  if (query.data.length === 0) return <Empty sentence="No drift detected. This fills in when Common App's pages change enough to lower extraction confidence." />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Section</TableHeaderCell>
            <TableHeaderCell>Confidence</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Created</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-medium">{alert.section}</TableCell>
              <TableCell numeric muted>
                {alert.confidence.toFixed(2)}
              </TableCell>
              <TableCell className={alert.status === 'open' ? 'text-fg' : 'text-fg-2'}>{alert.status === 'open' ? 'Open' : 'Resolved'}</TableCell>
              <TableCell muted className="hidden text-12 sm:table-cell">
                {relativeTimeFromNow(alert.created_at)}
              </TableCell>
              <TableCell>
                <ResolveActions alert={alert} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
