import type { ComponentType } from 'react';
import { StepAcademics } from '@/components/onboarding/step-academics';
import { StepActivities } from '@/components/onboarding/step-activities';
import { StepBasics } from '@/components/onboarding/step-basics';
import { StepConnect } from '@/components/onboarding/step-connect';
import { StepFirstSync } from '@/components/onboarding/step-first-sync';
import { StepGoalsSchools } from '@/components/onboarding/step-goals-schools';
import { StepIntangibles } from '@/components/onboarding/step-intangibles';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';

export interface OnboardingStepDef {
  title: string;
  component: ComponentType<OnboardingStepProps>;
}

export const ONBOARDING_STEPS: Record<number, OnboardingStepDef> = {
  1: { title: 'Basics', component: StepBasics },
  2: { title: 'Academics', component: StepAcademics },
  3: { title: 'Activities', component: StepActivities },
  4: { title: 'Intangibles', component: StepIntangibles },
  5: { title: 'Goals & schools', component: StepGoalsSchools },
  6: { title: 'Connect', component: StepConnect },
  7: { title: 'First sync', component: StepFirstSync },
};

export const ONBOARDING_STEP_NUMBERS = Object.keys(ONBOARDING_STEPS).map(Number).sort((a, b) => a - b);

export function getOnboardingStep(step: number): OnboardingStepDef | null {
  return ONBOARDING_STEPS[step] ?? null;
}
