import { ONBOARDING_STEP_COUNT } from '@tbd/shared/domain';
import { ONBOARDING_STEPS } from '@/components/onboarding/step-config';
import { Progress } from '@/components/ui/progress';

export function OnboardingProgress({ currentStep, agentName }: { currentStep: number; agentName: string }) {
  const percent = (currentStep / ONBOARDING_STEP_COUNT) * 100;
  const title = ONBOARDING_STEPS[currentStep]?.title ?? '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Setting up with {agentName}</span>
        <span>
          Step {currentStep} of {ONBOARDING_STEP_COUNT}
        </span>
      </div>
      <Progress value={percent} />
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}
