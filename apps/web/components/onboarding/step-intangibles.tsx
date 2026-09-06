'use client';

import type { StudentNarrative } from '@apogee/shared/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InterviewChat, TERMINAL_RUN_OUTCOMES } from '@/components/onboarding/interview-chat';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Button, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const UNSUCCESSFUL_OUTCOMES = new Set(['failed', 'refused', 'no_action']);

/** Step 4: the interview conversation, then reviewing the narrative it produces. */
export function StepIntangibles({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);

  const [runId, setRunId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<StudentNarrative | null>(onboarding.narrative?.narrative ?? null);
  const [editing, setEditing] = useState(false);

  // A student revisiting this step with an already-built narrative lands on the review question
  // rather than re-starting the chat.
  useEffect(() => {
    if (onboarding.narrative && nav.question === 1) nav.goToQuestion(2);
  }, []);

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
      nav.goToQuestion(2);
    } else if (runQuery.data && UNSUCCESSFUL_OUTCOMES.has(runQuery.data.outcome)) {
      toast("Could not build a summary from that yet. Answer a couple more questions and try again.");
    }
  }, [runQuery.data, narrativeQuery.data]);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!narrative) throw new Error('no narrative');
      await clientApi.call('narrativeUpdate', { body: narrative });
      return clientApi.call('onboardingStep', { body: { step: 4, data: { narrative_confirmed: true } } });
    },
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast('Could not save. Try again.'),
  });

  const summarizing = summarize.isPending || (runId !== null && (!runQuery.data || runQuery.data.outcome === 'pending' || runQuery.data.outcome === 'running'));

  if (questionId === 'interview') {
    return (
      <QuestionLayout
        question="Tell Vector about yourself."
        context="A short conversation. Vector uses it to write in your voice, not its own."
        whyWeAsk={<WhyWeAsk>Essays land better when they draw on something real. Nothing here is used word for word.</WhyWeAsk>}
        onSubmit={(event) => {
          event.preventDefault();
          summarize.mutate();
        }}
        onBack={nav.goBack}
        backHidden={nav.isFirstOverall}
        continueLabel="I'm done talking"
        continueLoading={summarizing}
      >
        <InterviewChat timezone={onboarding.student.timezone} />
      </QuestionLayout>
    );
  }

  // 'review' — the last question of this step. No built-in Back here: "Talk more" replaces it.
  return (
    <QuestionLayout
      question="Does this sound like you?"
      onSubmit={(event) => {
        event.preventDefault();
        confirm.mutate();
      }}
      backHidden
      continueLabel="Yes, continue"
      continueLoading={confirm.isPending}
      continueDisabled={!narrative}
      footerExtra={
        <>
          <Button type="button" variant="text" onClick={() => setEditing((value) => !value)} disabled={!narrative}>
            {editing ? 'Done editing' : 'Edit'}
          </Button>
          <Button type="button" variant="quiet" onClick={() => nav.goToQuestion(1)}>
            Talk more
          </Button>
        </>
      }
    >
      {!narrative ? (
        <p className="text-14 text-fg-2">Building your summary.</p>
      ) : editing ? (
        <NarrativeReview narrative={narrative} onChange={setNarrative} />
      ) : (
        <p className="text-14 text-fg">{narrative.summary}</p>
      )}
    </QuestionLayout>
  );
}
