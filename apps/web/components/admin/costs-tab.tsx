'use client';

import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { Button, Empty, ErrorNote, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 15_000;

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export function CostsTab() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const query = useQuery({ queryKey: ['admin', 'costs'], queryFn: () => clientApi.call('adminCosts'), refetchInterval: POLL_MS });

  if (query.isError) {
    return (
      <ErrorNote>
        Could not load costs.{' '}
        <Button variant="text" className="h-auto px-0" onClick={() => query.refetch()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }
  if (!query.data) return null;
  if (query.data.students.length === 0) return <Empty sentence="No usage yet. Token and browser-minute costs appear here once runs start recording." />;

  const totals = query.data.students.reduce(
    (acc, student) => ({
      input_tokens: acc.input_tokens + student.input_tokens,
      output_tokens: acc.output_tokens + student.output_tokens,
      estimated_llm_usd: acc.estimated_llm_usd + student.estimated_llm_usd,
      browser_minutes: acc.browser_minutes + student.browser_minutes,
      runs: acc.runs + student.runs,
      jobs: acc.jobs + student.jobs,
    }),
    { input_tokens: 0, output_tokens: 0, estimated_llm_usd: 0, browser_minutes: 0, runs: 0, jobs: 0 },
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-14 text-fg-2">Since {formatInTimeZone(new Date(query.data.since), timezone, 'MMM d')}</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Student</TableHeaderCell>
              <TableHeaderCell>Input tokens</TableHeaderCell>
              <TableHeaderCell>Output tokens</TableHeaderCell>
              <TableHeaderCell>Est. cost</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">Browser min</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">Runs</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">Jobs</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data.students.map((student) => (
              <TableRow key={student.student_id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell numeric muted>
                  {student.input_tokens.toLocaleString()}
                </TableCell>
                <TableCell numeric muted>
                  {student.output_tokens.toLocaleString()}
                </TableCell>
                <TableCell numeric>{usdFormatter.format(student.estimated_llm_usd)}</TableCell>
                <TableCell numeric muted className="hidden sm:table-cell">
                  {student.browser_minutes.toFixed(1)}
                </TableCell>
                <TableCell numeric muted className="hidden sm:table-cell">
                  {student.runs}
                </TableCell>
                <TableCell numeric muted className="hidden sm:table-cell">
                  {student.jobs}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell numeric className="font-medium">
                {totals.input_tokens.toLocaleString()}
              </TableCell>
              <TableCell numeric className="font-medium">
                {totals.output_tokens.toLocaleString()}
              </TableCell>
              <TableCell numeric className="font-medium">
                {usdFormatter.format(totals.estimated_llm_usd)}
              </TableCell>
              <TableCell numeric className="hidden font-medium sm:table-cell">
                {totals.browser_minutes.toFixed(1)}
              </TableCell>
              <TableCell numeric className="hidden font-medium sm:table-cell">
                {totals.runs}
              </TableCell>
              <TableCell numeric className="hidden font-medium sm:table-cell">
                {totals.jobs}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
