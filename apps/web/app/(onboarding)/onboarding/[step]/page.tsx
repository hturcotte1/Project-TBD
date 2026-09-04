import { notFound, redirect } from 'next/navigation';
import { getOnboardingStep } from '@/components/onboarding/step-config';
import { serverApi } from '@/lib/api.server';
import { requireStudent } from '@/lib/auth';

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  await requireStudent();
  const { step: stepParam } = await params;
  const step = Number(stepParam);

  const stepDef = Number.isInteger(step) ? getOnboardingStep(step) : null;
  if (!stepDef) notFound();

  const api = serverApi();
  const state = await api.call('onboardingGet');

  if (state.completed) redirect('/');
  // Resumable: can't jump ahead of where the student has actually reached, but can go back to edit.
  if (step > state.step) redirect(`/onboarding/${state.step}`);

  const StepComponent = stepDef.component;
  return <StepComponent onboarding={state} step={step} />;
}
