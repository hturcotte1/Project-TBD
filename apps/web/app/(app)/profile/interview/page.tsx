'use client';

import type { AgentRunDto } from '@apogee/shared/api';
import type { StudentNarrative } from '@apogee/shared/schemas';
import { Sparkle } from '@phosphor-icons/react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InterviewChat } from '@/components/onboarding/interview-chat';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { Button, PageTitle, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);
const UNSUCCESSFUL_OUTCOMES = new Set<AgentRunDto['outcome']>(['failed', 'refused', 'no_action']);

export default function ProfileInterviewPage() {
  const router = useRouter();

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  const [mode, setMode] = useState<'chat' | 'review'>('chat');
  const [runId, setRunId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<StudentNarrative | null>(null);

  const summarize = useMutation({
    mutationFn: () => clientApi.call('narrativeSummarize'),
    onSuccess: (result) => setRunId(result.run_id),
    onError: () => toast('Could not start the summary. Try again in a moment.'),
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
      toast('Could not build a summary from that yet. Answer a couple more questions and try again.');
    }
  }, [runQuery.data, narrativeQuery.data]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!narrative) throw new Error('no narrative');
      return clientApi.call('narrativeUpdate', { body: narrative });
    },
    onSuccess: () => {
      toast('Your story is saved.');
      router.push('/profile');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  const summarizing = summarize.isPending || (runId !== null && (!runQuery.data || runQuery.data.outcome === 'pending' || runQuery.data.outcome === 'running'));

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — the interview has no numeral of its own. A hidden span still warms the font file
          so it's not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <div className="flex flex-col gap-1">
        <PageTitle>Your story</PageTitle>
        <p className="text-14 text-fg-2">A short conversation with Vector so your applications sound like you.</p>
      </div>

      {mode === 'chat' ? (
        <div className="flex max-w-measure flex-col gap-4">
          <InterviewChat timezone={timezone} />
          <div>
            <Button variant="text" loading={summarizing} onClick={() => summarize.mutate()}>
              <Sparkle /> Wrap up and summarize
            </Button>
          </div>
        </div>
      ) : narrative ? (
        <div className="flex max-w-measure flex-col gap-4">
          <NarrativeReview narrative={narrative} onChange={setNarrative} />
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="quiet" onClick={() => setMode('chat')}>
              Keep talking instead
            </Button>
            <Button variant="primary" className="ml-auto" loading={confirm.isPending} onClick={() => confirm.mutate()}>
              Save and return to profile
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-14 text-fg-2">Building your summary.</p>
      )}
    </div>
  );
}
