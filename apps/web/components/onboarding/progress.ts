/**
 * Pure fill computation for the onboarding layout's 7-segment progress bar (see
 * `progress-segments.tsx`). No "Step 3 of 7" text and no step titles per the spec — the only
 * thing rendered is how much of each segment is filled.
 */
import { getQuestionCount } from '@/components/onboarding/step-questions';

export type SegmentState = 'done' | 'current' | 'future';

export interface ProgressSegment {
  state: SegmentState;
  /** Fraction of the segment that is filled, 0 to 1. Always 1 for 'done' and 0 for 'future'. */
  fill: number;
}

const TOTAL_STEPS = 7;

/**
 * One segment per step. Steps before `step` are fully done; steps after are empty and future;
 * `step` itself is partially filled by how far `questionIndex` is through that step's questions
 * (1-based, clamped to the step's real question count so an out-of-range index never over- or
 * under-fills).
 */
export function computeProgressSegments(step: number, questionIndex: number, totalSteps = TOTAL_STEPS): ProgressSegment[] {
  const segments: ProgressSegment[] = [];
  for (let s = 1; s <= totalSteps; s += 1) {
    if (s < step) {
      segments.push({ state: 'done', fill: 1 });
    } else if (s === step) {
      const total = getQuestionCount(s);
      const clamped = Math.min(Math.max(questionIndex, 1), total);
      segments.push({ state: 'current', fill: clamped / total });
    } else {
      segments.push({ state: 'future', fill: 0 });
    }
  }
  return segments;
}
