'use client';

import type { AgentRunDto } from '@tbd/shared/api';
import type { StudentNarrative } from '@tbd/shared/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { InterviewChat } from '@/components/onboarding/interview-chat';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);
const UNSUCCESSFUL_OUTCOMES = new Set<AgentRunDto['outcome']>(['failed', 'refused', 'no_action']);

export default function ProfileInterviewPage() {
  const router = useRouter();
  const { toast } = useToast();

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  const [mode, setMode] = useState<'chat' | 'review'>('chat');
  const [runId, setRunId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<StudentNarrative | null>(null);

  const summarize = useMutation({
    mutationFn: () => clientApi.call('narrativeSummarize'),
    onSuccess: (result) => setRunId(result.run_id),
    onError: () => toast({ title: 'Could not start the summary — try again in a moment.', variant: 'destructive' }),
  });

  const runQuery = useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => clientApi.call('agentRunGet', { params: { id: runId as string } }),
    enabled: runId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_RUN_OUTCOMES.has(query.state.data.outcome) ? false : 1500),
  });

  const narrativeQuery = useQuery({
    queryKey: ['narrative'],
    queryFn: () => clientApi.call('narrativeGet'),
    enabled: runQuery.data?.outcome === 'completed',
  });

  useEffect(() => {
    if (runQuery.data?.outcome === 'completed' && narrativeQuery.data) {
      setNarrative(narrativeQuery.data.narrative);
      setMode('review');
    } else if (runQuery.data && UNSUCCESSFUL_OUTCOMES.has(runQuery.data.outcome)) {
      toast({ title: "Couldn't build a summary from that yet", description: 'Answer a couple more questions and try again.', variant: 'destructive' });
    }
  }, [runQuery.data, narrativeQuery.data, toast]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!narrative) throw new Error('no narrative');
      return clientApi.call('narrativeUpdate', { body: narrative });
    },
    onSuccess: () => {
      toast({ title: 'Your story is saved' });
      router.push('/profile');
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  const summarizing = summarize.isPending || (runId !== null && (!runQuery.data || runQuery.data.outcome === 'pending' || runQuery.data.outcome === 'running'));

  return (
    <div className="pb-8">
      <PageHeader title="The interview" description="A short conversation — Remy uses this to write in your voice, not its own." />
      <div className="space-y-4 px-4 py-5 sm:px-6 sm:max-w-2xl">
        {mode === 'chat' ? (
          <div className="space-y-4">
            <InterviewChat timezone={timezone} />
            <Button type="button" variant="outline" onClick={() => summarize.mutate()} loading={summarizing}>
              <Sparkles className="h-3.5 w-3.5" /> Wrap up &amp; summarize
            </Button>
          </div>
        ) : narrative ? (
          <div className="space-y-4">
            <NarrativeReview narrative={narrative} onChange={setNarrative} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('chat')}>
                Keep talking instead
              </Button>
              <Button type="button" className="ml-auto" onClick={() => confirm.mutate()} loading={confirm.isPending}>
                Save and return to profile
              </Button>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Building your summary…
          </p>
        )}
      </div>
    </div>
  );
}
