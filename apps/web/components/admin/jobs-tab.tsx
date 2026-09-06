'use client';

import type { BrowserJobDto } from '@apogee/shared/api';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Empty,
  ErrorNote,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextLink,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;
const PAGE_SIZE = 100;

const KIND_LABELS: Record<BrowserJobDto['kind'], string> = {
  verify_credentials: 'Verify credentials',
  full_sync: 'Full sync',
  fill_fields: 'Fill fields',
  check_recommenders: 'Check recommenders',
};

function statusWord(status: BrowserJobDto['status']): string {
  return status.replace(/_/g, ' ');
}

export function JobsTab() {
  const query = useQuery({
    queryKey: ['admin', 'jobs'],
    queryFn: () => clientApi.call('adminJobs', { query: { limit: PAGE_SIZE } }),
    refetchInterval: POLL_MS,
  });

  if (query.isError) {
    return (
      <ErrorNote>
        Could not load jobs.{' '}
        <Button variant="text" className="h-auto px-0" onClick={() => query.refetch()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }
  if (!query.data) return null;
  if (query.data.length === 0) return <Empty sentence="No browser jobs yet. Jobs appear here once a sync runs." />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Kind</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Student</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Attempts</TableHeaderCell>
            <TableHeaderCell className="hidden lg:table-cell">Error</TableHeaderCell>
            <TableHeaderCell className="hidden sm:table-cell">Replay</TableHeaderCell>
            <TableHeaderCell>Started</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{KIND_LABELS[job.kind]}</TableCell>
              <TableCell className="hidden font-mono text-12 text-fg-3 lg:table-cell">{job.student_id}</TableCell>
              <TableCell muted>{statusWord(job.status)}</TableCell>
              <TableCell numeric muted className="hidden sm:table-cell">
                {job.attempts}
              </TableCell>
              <TableCell className="hidden max-w-[220px] lg:table-cell">
                {job.error ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block truncate text-err">{job.error}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{job.error}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-fg-3">–</span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {job.replay_url ? (
                  <TextLink href={job.replay_url} target="_blank" rel="noopener noreferrer">
                    Replay
                  </TextLink>
                ) : null}
              </TableCell>
              <TableCell muted className="text-12">
                {job.started_at ? relativeTimeFromNow(job.started_at) : '–'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
