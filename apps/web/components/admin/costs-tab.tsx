'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 15_000;

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export function CostsTab() {
  const query = useQuery({ queryKey: ['admin', 'costs'], queryFn: () => clientApi.call('adminCosts'), refetchInterval: POLL_MS });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load costs — try refreshing.</p>;
  if (query.data.students.length === 0) return <EmptyState icon={DollarSign} title="No usage yet" description="Token and browser-minute costs per student appear here once runs start recording." />;

  const totals = query.data.students.reduce(
    (acc, s) => ({
      input_tokens: acc.input_tokens + s.input_tokens,
      output_tokens: acc.output_tokens + s.output_tokens,
      estimated_llm_usd: acc.estimated_llm_usd + s.estimated_llm_usd,
      browser_minutes: acc.browser_minutes + s.browser_minutes,
    }),
    { input_tokens: 0, output_tokens: 0, estimated_llm_usd: 0, browser_minutes: 0 },
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Since {relativeTimeFromNow(query.data.since)}</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 text-center font-medium">Input tokens</th>
              <th className="px-3 py-2 text-center font-medium">Output tokens</th>
              <th className="px-3 py-2 text-center font-medium">Est. LLM cost</th>
              <th className="px-3 py-2 text-center font-medium">Browser minutes</th>
              <th className="px-3 py-2 text-center font-medium">Runs</th>
              <th className="px-3 py-2 text-center font-medium">Jobs</th>
            </tr>
          </thead>
          <tbody>
            {query.data.students.map((s) => (
              <tr key={s.student_id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-center tabular-nums">{s.input_tokens.toLocaleString()}</td>
                <td className="px-3 py-2 text-center tabular-nums">{s.output_tokens.toLocaleString()}</td>
                <td className="px-3 py-2 text-center tabular-nums">{usdFormatter.format(s.estimated_llm_usd)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{s.browser_minutes.toFixed(1)}</td>
                <td className="px-3 py-2 text-center tabular-nums">{s.runs}</td>
                <td className="px-3 py-2 text-center tabular-nums">{s.jobs}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-center tabular-nums">{totals.input_tokens.toLocaleString()}</td>
              <td className="px-3 py-2 text-center tabular-nums">{totals.output_tokens.toLocaleString()}</td>
              <td className="px-3 py-2 text-center tabular-nums">{usdFormatter.format(totals.estimated_llm_usd)}</td>
              <td className="px-3 py-2 text-center tabular-nums">{totals.browser_minutes.toFixed(1)}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
