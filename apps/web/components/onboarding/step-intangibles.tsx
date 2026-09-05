'use client';

import type { StudentNarrative } from '@apogee/shared/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InterviewChat, TERMINAL_RUN_OUTCOMES } from '@/components/onboarding/interview-chat';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const UNSUCCESSFUL_OUTCOMES = new Set(['failed', 'refused', 'no_action']);

export function StepIntangibles({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [mode, setMode] = useState<'chat' | 'review'>(onboarding.narrative ? 'review' : 'chat');
  const [runId, setRunId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<StudentNarrative | null>(onboarding.narrative?.narrative ?? null);

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
      await clientApi.call('narrativeUpdate', { body: narrative });
      return clientApi.call('onboardingStep', { body: { step: 4, data: { narrative_confirmed: true } } });
    },
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  const summarizing = summarize.isPending || (runId !== null && (!runQuery.data || runQuery.data.outcome === 'pending' || runQuery.data.outcome === 'running'));

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Getting to know you</h1>
        <p className="text-sm text-muted-foreground">A short conversation — Vector uses this to write in your voice, not its own.</p>
      </div>

      <WhyWeAsk>
        Essays and short answers land better when they draw on something real. Nothing here gets used word-for-word — it helps Vector ask
        better questions and give sharper feedback later.
      </WhyWeAsk>

      {mode === 'chat' ? (
        <div className="space-y-4">
          <InterviewChat timezone={onboarding.student.timezone} />
          <Button type="button" variant="outline" onClick={() => summarize.mutate()} loading={summarizing}>
            <Sparkles className="h-3.5 w-3.5" /> Wrap up &amp; summarize
          </Button>
        </div>
      ) : narrative ? (
        <div className="space-y-4">
          <NarrativeReview narrative={narrative} onChange={setNarrative} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('chat')}>
            Keep talking instead
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building your summary…
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          confirm.mutate();
        }}
      >
        <StepActions step={step} loading={confirm.isPending} submitLabel="Looks right" disabled={mode !== 'review' || !narrative} />
      </form>
    </div>
  );
}
