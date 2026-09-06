'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { Button, Checkbox, Field, Input, OkNote, Prose, TextLink, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

/** Step 6: connect Common App (with its verification-code detour), then a final acknowledgement. */
export function StepConnect({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(onboarding.credentials.connected);

  const syncStatusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => clientApi.call('syncStatus'),
    refetchInterval: (query) => {
      const s = query.state.data;
      if (!s) return 3000;
      if (s.awaiting_verification_job_id) return 2000;
      if (s.last_job && ACTIVE_JOB_STATUSES.has(s.last_job.status)) return 2000;
      return false;
    },
  });

  const status = syncStatusQuery.data;
  const connected = status?.credentials.connected ?? onboarding.credentials.connected;
  const awaitingCode = Boolean(status?.awaiting_verification_job_id);

  // Follow the browser job's own state: once it asks for a code, move to the code question; once
  // it resolves to connected, skip ahead to the closing acknowledgement.
  useEffect(() => {
    if (nav.question === 1 && awaitingCode) nav.goToQuestion(2);
    else if (nav.question === 2 && !awaitingCode && connected) nav.goToQuestion(3);
  }, [awaitingCode, connected, nav.question]);

  const connect = useMutation({
    mutationFn: () => clientApi.call('credentialsConnectCommonApp', { body: { email, password } }),
    onSuccess: () => {
      setPassword('');
      setConnectError(null);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: () => setConnectError('Could not connect. Check the email and password and try again.'),
  });

  const submitCode = useMutation({
    mutationFn: () => clientApi.call('verificationCodeSubmit', { body: { code } }),
    onSuccess: () => {
      setCode('');
      setCodeError(null);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
    onError: () => setCodeError('That code did not work. Try again, or wait for a fresh one.'),
  });

  const save = useMutation({
    mutationFn: () => clientApi.call('onboardingStep', { body: { step: 6, data: { acknowledged } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast('Could not save. Try again.'),
  });

  if (questionId === 'connect') {
    return (
      <QuestionLayout
        question="Connect your Common App?"
        onSubmit={(event) => {
          event.preventDefault();
          if (connected) {
            nav.goToQuestion(3);
            return;
          }
          connect.mutate();
        }}
        onBack={nav.goBack}
        backHidden={nav.isFirstOverall}
        continueLabel={connected ? 'Continue' : 'Connect'}
        continueLoading={connect.isPending}
        continueDisabled={!connected && (!email || !password)}
        footerExtra={
          !connected ? (
            <Button type="button" variant="text" onClick={() => nav.goToQuestion(3)}>
              Skip for now
            </Button>
          ) : undefined
        }
      >
        <Prose>
          <p>
            Vector reads your Common App account: what is filled in, in progress, or missing. Then, with your approval field by field,
            it fills in what you ask it to. It never submits anything. Your password is encrypted at rest and decrypted only for a few
            seconds inside Vector's browser worker.{' '}
            <TextLink href="/privacy">Read the full privacy page</TextLink>.
          </p>
        </Prose>
        {connected ? (
          <OkNote>Connected</OkNote>
        ) : (
          <>
            <Field label="Common App email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Common App password" error={connectError ?? undefined}>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
          </>
        )}
      </QuestionLayout>
    );
  }

  if (questionId === 'verify') {
    return (
      <QuestionLayout
        question="What's the code Common App sent you?"
        context={`Common App just sent a code. Text it to ${onboarding.agent_name} or enter it here.`}
        onSubmit={(event) => {
          event.preventDefault();
          submitCode.mutate();
        }}
        onBack={() => nav.goToQuestion(1)}
        continueLabel="Send code"
        continueLoading={submitCode.isPending}
        continueDisabled={!code}
      >
        <Field label="Verification code" error={codeError ?? undefined}>
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={12} className="font-mono" />
        </Field>
      </QuestionLayout>
    );
  }

  // 'ready' — the last question of this step.
  return (
    <QuestionLayout
      question="Ready?"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      onBack={() => nav.goToQuestion(1)}
      continueLoading={save.isPending}
      continueDisabled={!acknowledged}
    >
      <label className="flex items-start gap-2 text-14 text-fg">
        <Checkbox checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked === true)} className="mt-0.5" />
        I understand how my Common App password is used and stored.
      </label>
    </QuestionLayout>
  );
}
