/**
 * The question-by-question shape of onboarding: one h1-phrased question per screen, grouped under
 * the 7 steps the API still saves (`OnboardingStepBody`). Purely data — no component here — so the
 * count and order can be unit tested and the progress bar (`progress.ts`) can compute fill without
 * importing any UI.
 */
export interface StepQuestion {
  /** Stable id for the question within its step; used by step components to switch on. */
  id: string;
  /** The literal h1 text rendered for this question. */
  label: string;
}

export const STEP_QUESTIONS: Readonly<Record<number, readonly StepQuestion[]>> = {
  1: [
    { id: 'name', label: "What's your name?" },
    { id: 'phone', label: 'What number should Vector text?' },
    { id: 'school', label: 'Where do you go to school?' },
    { id: 'timezone', label: 'What time zone are you in?' },
    { id: 'quiet-hours', label: 'When should Vector stay quiet?' },
    { id: 'nudge-intensity', label: 'How often should Vector nudge you?' },
  ],
  2: [
    { id: 'transcript', label: 'Do you have a transcript to upload?' },
    { id: 'gpa', label: "What's your GPA?" },
    { id: 'test-scores', label: 'Any test scores?' },
  ],
  3: [
    { id: 'resume', label: 'Have a resume?' },
    { id: 'activities', label: 'What do you spend your time on?' },
  ],
  4: [
    { id: 'interview', label: 'Tell Vector about yourself.' },
    { id: 'review', label: 'Does this sound like you?' },
  ],
  5: [
    { id: 'majors', label: 'What might you study?' },
    { id: 'geography', label: 'Where would you like to be?' },
    { id: 'cost', label: 'How much does cost matter?' },
    { id: 'demographics', label: 'Anything colleges should know?' },
    { id: 'schools', label: 'Which schools?' },
  ],
  6: [
    { id: 'connect', label: 'Connect your Common App?' },
    { id: 'verify', label: 'What’s the code Common App sent you?' },
    { id: 'ready', label: 'Ready?' },
  ],
  7: [{ id: 'sync', label: 'First sync' }],
} as const;

/** Every question for a step, in display order. Empty for an unknown step rather than throwing. */
export function getQuestions(step: number): readonly StepQuestion[] {
  return STEP_QUESTIONS[step] ?? [];
}

/** How many questions a step has (minimum 1, so a step with no data still has a screen to land on). */
export function getQuestionCount(step: number): number {
  return Math.max(1, getQuestions(step).length);
}

/** The question id at a given 1-based index within a step, or null if out of range. */
export function getQuestionId(step: number, index: number): string | null {
  return getQuestions(step)[index - 1]?.id ?? null;
}
