'use client';

import type { ActivityDto } from '@tbd/shared/api';
import type { ActivityInput } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActivitiesEditor } from '@/components/onboarding/activities-editor';
import { ResumeUpload } from '@/components/onboarding/resume-upload';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

/** Server rows carry an `order` index; the editor works on plain Common App-shaped inputs. */
function toActivityInputs(dtos: ActivityDto[]): ActivityInput[] {
  return [...dtos].sort((a, b) => a.order - b.order).map(({ id: _id, order: _order, ...rest }) => rest);
}

export function StepActivities({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityInput[]>(() => toActivityInputs(onboarding.activities));

  const save = useMutation({
    mutationFn: () => clientApi.call('onboardingStep', { body: { step: 3, data: { activities } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Activities</h1>
        <p className="text-sm text-muted-foreground">Up to 10, in the order they matter most to you — Common App&rsquo;s own limit.</p>
      </div>

      <ResumeUpload onApplied={setActivities} />

      <ActivitiesEditor activities={activities} onChange={setActivities} />

      <StepActions step={step} loading={save.isPending} />
    </form>
  );
}
