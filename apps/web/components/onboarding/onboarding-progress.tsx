'use client';

import { useParams } from 'next/navigation';
import { ONBOARDING_STEP_COUNT } from '@tbd/shared/domain';
import { ONBOARDING_STEPS } from '@/components/onboarding/step-config';
import { Progress } from '@/components/ui/progress';

/**
 * Header for the onboarding layout. The layout persists across `/onboarding/[step]` navigations,
 * so the step shown must come from the current route, not from the server-rendered state.
 */
export function OnboardingProgress({ currentStep, agentName }: { currentStep: number; agentName: string }) {
  const params = useParams<{ step?: string }>();
  const routeStep = Number(params?.step);
  const step = Number.isInteger(routeStep) && routeStep >= 1 && routeStep <= ONBOARDING_STEP_COUNT ? routeStep : currentStep;
  const percent = (step / ONBOARDING_STEP_COUNT) * 100;
  const title = ONBOARDING_STEPS[step]?.title ?? '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Setting up with {agentName}</span>
        <span>
          Step {step} of {ONBOARDING_STEP_COUNT}
        </span>
      </div>
      <Progress value={percent} />
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}
