'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, Empty, ErrorNote, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 15_000;

export function QueuesTab() {
  const query = useQuery({ queryKey: ['admin', 'queues'], queryFn: () => clientApi.call('adminQueues'), refetchInterval: POLL_MS });

  if (query.isError) {
    return (
      <ErrorNote>
        Could not load queue health.{' '}
        <Button variant="text" className="h-auto px-0" onClick={() => query.refetch()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }
  if (!query.data) return null;
  if (query.data.length === 0) return <Empty sentence="No queues reporting yet. Queue health appears once the worker has processed a job." />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Queue</TableHeaderCell>
            <TableHeaderCell>Waiting</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Active</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Delayed</TableHeaderCell>
            <TableHeaderCell>Failed</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Completed</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.map((row) => (
            <TableRow key={row.queue}>
              <TableCell className="font-medium">{row.queue}</TableCell>
              <TableCell numeric muted>
                {row.waiting}
              </TableCell>
              <TableCell numeric muted className="hidden sm:table-cell">
                {row.active}
              </TableCell>
              <TableCell numeric muted className="hidden sm:table-cell">
                {row.delayed}
              </TableCell>
              <TableCell numeric className={row.failed > 0 ? 'text-err' : 'text-fg-2'}>
                {row.failed}
              </TableCell>
              <TableCell numeric muted className="hidden sm:table-cell">
                {row.completed}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
