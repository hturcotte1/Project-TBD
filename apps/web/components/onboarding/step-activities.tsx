'use client';

import type { ActivityDto } from '@apogee/shared/api';
import type { ActivityInput } from '@apogee/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActivitiesEditor } from '@/components/onboarding/activities-editor';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import { ResumeUpload } from '@/components/onboarding/resume-upload';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { Button, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

/** Server rows carry an `order` index; the editor works on plain Common App-shaped inputs. */
function toActivityInputs(dtos: ActivityDto[]): ActivityInput[] {
  return [...dtos].sort((a, b) => a.order - b.order).map(({ id: _id, order: _order, ...rest }) => rest);
}

/** Step 3: resume upload, then the activities list — one question per screen. */
export function StepActivities({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);
  const [activities, setActivities] = useState<ActivityInput[]>(() => toActivityInputs(onboarding.activities));

  const save = useMutation({
    mutationFn: () => clientApi.call('onboardingStep', { body: { step: 3, data: { activities } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast('Could not save. Try again.'),
  });

  if (questionId === 'resume') {
    return (
      <QuestionLayout
        question="Have a resume?"
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
        footerExtra={
          <Button variant="text" onClick={() => nav.goNext()}>
            Skip for now
          </Button>
        }
      >
        <ResumeUpload onApplied={setActivities} />
      </QuestionLayout>
    );
  }

  // 'activities' — the last question of this step.
  return (
    <QuestionLayout
      question="What do you spend your time on?"
      context="Up to 10, in the order they matter most to you. That's Common App's own limit."
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      onBack={nav.goBack}
      continueLoading={save.isPending}
    >
      <ActivitiesEditor activities={activities} onChange={setActivities} />
    </QuestionLayout>
  );
}
