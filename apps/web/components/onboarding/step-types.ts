import type { OnboardingStateDto } from '@apogee/shared/api';

export interface OnboardingStepProps {
  onboarding: OnboardingStateDto;
  /** The step number currently being rendered (may differ from `onboarding.step` when editing an earlier step). */
  step: number;
}
