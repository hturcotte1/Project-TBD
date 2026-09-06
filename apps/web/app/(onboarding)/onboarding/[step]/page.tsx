import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getOnboardingStep } from '@/components/onboarding/step-config';
import { serverApi } from '@/lib/api.server';
import { requireStudent } from '@/lib/auth';

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  await requireStudent();
  const { step: stepParam } = await params;
  const step = Number(stepParam);

  const StepComponent = Number.isInteger(step) ? getOnboardingStep(step) : null;
  if (!StepComponent) notFound();

  const api = serverApi();
  const state = await api.call('onboardingGet');

  if (state.completed) redirect('/');
  // Resumable: can't jump ahead of where the student has actually reached, but can go back to edit.
  if (step > state.step) redirect(`/onboarding/${state.step}`);

  return (
    // The step component reads the current question index via useSearchParams (see
    // use-question-nav.ts), which requires a Suspense boundary.
    <Suspense>
      <StepComponent onboarding={state} step={step} />
    </Suspense>
  );
}
