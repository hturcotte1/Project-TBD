import { describe, expect, it } from 'vitest';
import { computeProgressSegments } from '@/components/onboarding/progress';

describe('computeProgressSegments', () => {
  it('marks every step before the current one done and fully filled', () => {
    const segments = computeProgressSegments(3, 1);
    expect(segments[0]).toEqual({ state: 'done', fill: 1 });
    expect(segments[1]).toEqual({ state: 'done', fill: 1 });
  });

  it('marks every step after the current one future and empty', () => {
    const segments = computeProgressSegments(3, 1);
    expect(segments[3]).toEqual({ state: 'future', fill: 0 });
    expect(segments[6]).toEqual({ state: 'future', fill: 0 });
  });

  it('fills the current step by its question index over its real question count', () => {
    // Step 1 has 6 questions.
    expect(computeProgressSegments(1, 1)[0]).toEqual({ state: 'current', fill: 1 / 6 });
    expect(computeProgressSegments(1, 3)[0]).toEqual({ state: 'current', fill: 3 / 6 });
    expect(computeProgressSegments(1, 6)[0]).toEqual({ state: 'current', fill: 1 });
    // Step 3 has 2 questions.
    expect(computeProgressSegments(3, 2)[2]).toEqual({ state: 'current', fill: 1 });
  });

  it('clamps an out-of-range question index instead of over- or under-filling', () => {
    expect(computeProgressSegments(1, 0)[0]?.fill).toBe(1 / 6);
    expect(computeProgressSegments(1, 99)[0]?.fill).toBe(1);
  });

  it('returns one segment per step for the full 7-step flow', () => {
    expect(computeProgressSegments(1, 1)).toHaveLength(7);
    expect(computeProgressSegments(7, 1)).toHaveLength(7);
  });

  it('fills the last step fully once its one screen is reached', () => {
    const segments = computeProgressSegments(7, 1);
    expect(segments[5]).toEqual({ state: 'done', fill: 1 });
    expect(segments[6]).toEqual({ state: 'current', fill: 1 });
  });
});
