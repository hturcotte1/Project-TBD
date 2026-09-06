import type { ComponentType } from 'react';
import { StepAcademics } from '@/components/onboarding/step-academics';
import { StepActivities } from '@/components/onboarding/step-activities';
import { StepBasics } from '@/components/onboarding/step-basics';
import { StepConnect } from '@/components/onboarding/step-connect';
import { StepFirstSync } from '@/components/onboarding/step-first-sync';
import { StepGoalsSchools } from '@/components/onboarding/step-goals-schools';
import { StepIntangibles } from '@/components/onboarding/step-intangibles';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';

/** One component per step; each renders every question for that step, one at a time, keyed off
 * the `?q=` index (see `use-question-nav.ts`). */
export const ONBOARDING_STEPS: Record<number, ComponentType<OnboardingStepProps>> = {
  1: StepBasics,
  2: StepAcademics,
  3: StepActivities,
  4: StepIntangibles,
  5: StepGoalsSchools,
  6: StepConnect,
  7: StepFirstSync,
};

export function getOnboardingStep(step: number): ComponentType<OnboardingStepProps> | null {
  return ONBOARDING_STEPS[step] ?? null;
}
