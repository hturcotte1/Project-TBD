'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getQuestionCount } from '@/components/onboarding/step-questions';

export interface QuestionNav {
  /** 1-based index of the question currently shown, read from `?q=`. */
  question: number;
  /** True only on step 1's first question — the one place Back has nothing to go back to. */
  isFirstOverall: boolean;
  /** Jump to an arbitrary question within this step (for a step whose questions are conditional,
   * like Connect's verification code). */
  goToQuestion: (question: number) => void;
  /** Advance to the next question in this step. No-op on the step's last question — the step
   * component handles that transition itself (usually: save, then route to the next step). */
  goNext: () => void;
  /** Back one question, or into the previous step's last question from this step's first. No-op
   * on the very first question of the whole flow. */
  goBack: () => void;
}

/**
 * Reads the current question index from the URL (`?q=<n>`) so the browser's Back button and a
 * screenshot's direct navigation both land on the right question, and gives each step component
 * the few transitions it needs. `useSearchParams` requires a Suspense boundary (see
 * `[step]/page.tsx` and the onboarding layout) — worth it here, unlike elsewhere in the app, since
 * the spec calls for real browser-Back support, not just a shareable link read once on mount.
 */
export function useQuestionNav(step: number, totalQuestions: number = getQuestionCount(step)): QuestionNav {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = Number(searchParams.get('q'));
  const question = Number.isInteger(raw) && raw >= 1 && raw <= totalQuestions ? raw : 1;

  function goToQuestion(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', String(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  function goNext() {
    if (question < totalQuestions) goToQuestion(question + 1);
  }

  function goBack() {
    if (question > 1) {
      goToQuestion(question - 1);
      return;
    }
    if (step > 1) {
      router.push(`/onboarding/${step - 1}?q=${getQuestionCount(step - 1)}`);
    }
  }

  return { question, isFirstOverall: step === 1 && question === 1, goToQuestion, goNext, goBack };
}
