'use client';

import type { AgentRunDto } from '@apogee/shared/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ErrorNote, Section, TextLink, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);

export function DataExportSection() {
  const [runId, setRunId] = useState<string | null>(null);

  const startExport = useMutation({
    mutationFn: () => clientApi.call('accountExport'),
    onSuccess: (result) => {
      setRunId(result.run_id);
      toast('Preparing your export.');
    },
    onError: () => toast('Could not start the export. Try again.'),
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
    <Section title="Your data">
      <div className="flex flex-col items-start gap-2">
        {ready && runId ? (
          <TextLink href={`/api/proxy/account/export/${runId}`} target="_blank" rel="noopener noreferrer">
            Download export (JSON)
          </TextLink>
        ) : (
          <Button variant="text" className="h-auto px-0" loading={preparing} onClick={() => startExport.mutate()}>
            Export everything
          </Button>
        )}
        {failed ? <ErrorNote>Could not build the export. Try again.</ErrorNote> : null}
      </div>
    </Section>
  );
}
