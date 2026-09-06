'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ONBOARDING_STEP_COUNT } from '@apogee/shared/domain';
import { computeProgressSegments } from '@/components/onboarding/progress';
import { cn } from '@/lib/utils';

/**
 * Seven segments, no "Step 3 of 7" text and no step titles (DESIGN.md: the number is the hero,
 * everything around it is quiet). The layout persists across `/onboarding/[step]` navigations, so
 * both the step and the question index come from the current URL, not the server-rendered state
 * that was current when the layout itself first rendered.
 */
export function OnboardingProgress({ currentStep }: { currentStep: number }) {
  const params = useParams<{ step?: string }>();
  const searchParams = useSearchParams();

  const routeStep = Number(params?.step);
  const step = Number.isInteger(routeStep) && routeStep >= 1 && routeStep <= ONBOARDING_STEP_COUNT ? routeStep : currentStep;
  const rawQuestion = Number(searchParams.get('q'));
  const question = Number.isInteger(rawQuestion) && rawQuestion >= 1 ? rawQuestion : 1;

  const segments = computeProgressSegments(step, question);

  return (
    <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={ONBOARDING_STEP_COUNT} aria-valuenow={step} aria-label="Setup progress">
      {segments.map((segment, index) => (
        <div key={index} className={cn('h-1 flex-1 overflow-hidden rounded-full bg-line')}>
          {segment.state === 'done' ? <div className="h-full w-full rounded-full bg-fg-2" /> : null}
          {segment.state === 'current' ? <div className="h-full rounded-full bg-brand" style={{ width: `${segment.fill * 100}%` }} /> : null}
        </div>
      ))}
    </div>
  );
}
