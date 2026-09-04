'use client';

import type { AgentRunDto } from '@tbd/shared/api';
import type { RunOutcome, RunTrigger } from '@tbd/shared/domain';
import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const POLL_MS = 20_000;
const PAGE_SIZE = 100;

const TRIGGER_LABEL: Record<RunTrigger, string> = {
  inbound_message: 'Your text',
  schedule: 'Scheduled check-in',
  sync_diff: 'Sync change',
  manual: 'Manual',
  proactive: 'Proactive nudge',
  essay_feedback: 'Essay feedback',
  extraction: 'Document extraction',
  interview: 'Interview',
  weekly_plan: 'Weekly plan',
  approval: 'Approval',
  reminder_draft: 'Reminder draft',
};

const OUTCOME_VARIANT: Record<RunOutcome, BadgeProps['variant']> = {
  pending: 'outline',
  running: 'warn',
  completed: 'success',
  failed: 'destructive',
  refused: 'secondary',
  no_action: 'outline',
};

const OUTCOME_LABEL: Record<RunOutcome, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  refused: 'Refused',
  no_action: 'No action needed',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function RunCard({ run }: { run: AgentRunDto }) {
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{TRIGGER_LABEL[run.trigger]}</p>
            <Badge variant={OUTCOME_VARIANT[run.outcome]}>{OUTCOME_LABEL[run.outcome]}</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{relativeTimeFromNow(run.created_at)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {run.model} · {formatDuration(run.duration_ms)} · {run.input_tokens.toLocaleString()} in / {run.output_tokens.toLocaleString()} out tokens
        </p>
        {run.error ? <p className="rounded-md border border-urgent-border bg-urgent-bg px-2.5 py-1.5 text-xs text-urgent">{run.error}</p> : null}
        {run.tools_called.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {run.tools_called.map((tool, index) => (
              <Badge key={`${tool.name}-${index}`} variant={tool.ok ? 'secondary' : 'destructive'} title={tool.error ?? tool.input_summary}>
                {tool.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AgentRunsTab() {
  const query = useQuery({
    queryKey: ['agent-runs'],
    queryFn: () => clientApi.call('agentRunsList', { query: { limit: PAGE_SIZE } }),
    refetchInterval: POLL_MS,
  });

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load agent runs — try refreshing.</p>;
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No agent runs yet"
        description="Every time the agent thinks — replying to a text, drafting something, reacting to a sync — it shows up here with what model it used and what tools it called."
      />
    );
  }

  return (
    <div className="space-y-3">
      {query.data.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
