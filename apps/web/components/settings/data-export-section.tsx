'use client';

import type { AgentRunDto } from '@tbd/shared/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileJson, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);

export function DataExportSection() {
  const { toast } = useToast();
  const [runId, setRunId] = useState<string | null>(null);

  const startExport = useMutation({
    mutationFn: () => clientApi.call('accountExport'),
    onSuccess: (result) => setRunId(result.run_id),
    onError: () => toast({ title: 'Could not start the export — try again.', variant: 'destructive' }),
  });

  const runQuery = useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => clientApi.call('agentRunGet', { params: { id: runId as string } }),
    enabled: runId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_RUN_OUTCOMES.has(query.state.data.outcome) ? false : 2000),
  });

  const preparing = startExport.isPending || (runId !== null && !TERMINAL_RUN_OUTCOMES.has(runQuery.data?.outcome ?? 'pending'));
  const ready = runQuery.data?.outcome === 'completed';
  const failed = runQuery.data && runQuery.data.outcome !== 'completed' && TERMINAL_RUN_OUTCOMES.has(runQuery.data.outcome);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
        <CardDescription>Everything the agent stores about you, as one JSON file.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {ready && runId ? (
          <Button type="button" asChild>
            <a href={`/api/proxy/account/export/${runId}`} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" /> Download export
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => startExport.mutate()} disabled={preparing}>
            {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
            {preparing ? 'Preparing your export…' : 'Export my data'}
          </Button>
        )}
        {failed ? <p className="text-sm text-destructive">Could not build the export — try again.</p> : null}
      </CardContent>
    </Card>
  );
}
