import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { ProgressSegments } from '@/components/onboarding/progress-segments';
import { GlobalProgress } from '@/components/system';
import { serverApi } from '@/lib/api.server';
import { requireStudent } from '@/lib/auth';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await requireStudent();
  const api = serverApi();
  const state = await api.call('onboardingGet');

  if (state.completed) redirect('/');

  return (
    <div className="relative min-h-screen">
      <GlobalProgress />
      {/* DESIGN.md reserves the count face (Bricolage) for the numeral on step 7; a hidden span
          still warms the font file on every other step (same warm-up Activity, Schools and
          Essays do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-4">
          <p className="text-17 font-semibold">Apogee</p>
          {/* useSearchParams (via useQuestionNav) requires a Suspense boundary so the segment
              doesn't fully de-opt to client rendering. */}
          <Suspense fallback={<div className="flex h-1 gap-1" />}>
            <ProgressSegments currentStep={state.step} />
          </Suspense>
        </div>
        <div className="flex-1 text-left">{children}</div>
      </div>
    </div>
  );
}
