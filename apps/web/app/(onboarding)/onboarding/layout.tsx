import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress';
import { serverApi } from '@/lib/api.server';
import { requireStudent } from '@/lib/auth';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireStudent();
  const api = serverApi();
  const state = await api.call('onboardingGet');

  if (state.completed) redirect('/');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6 sm:px-6">
      <OnboardingProgress currentStep={state.step} agentName={state.agent_name} />
      <div className="flex-1 py-6">{children}</div>
    </div>
  );
}
