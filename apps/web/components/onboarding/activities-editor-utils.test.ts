import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX_LENGTH, MAX_ACTIVITIES, canAddActivity, descriptionRemaining } from '@/components/onboarding/activities-editor-utils';

describe('descriptionRemaining (Common App 150-char limit)', () => {
  it('counts down from 150', () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(150);
    expect(descriptionRemaining('')).toBe(150);
    expect(descriptionRemaining('a'.repeat(10))).toBe(140);
  });

  it('goes negative once the description is over the limit, rather than clamping', () => {
    expect(descriptionRemaining('a'.repeat(150))).toBe(0);
    expect(descriptionRemaining('a'.repeat(151))).toBe(-1);
  });
});

describe('canAddActivity (10-activity cap)', () => {
  it('allows adding below the cap', () => {
    expect(MAX_ACTIVITIES).toBe(10);
    expect(canAddActivity(0)).toBe(true);
    expect(canAddActivity(9)).toBe(true);
  });

  it('blocks adding at or above the cap', () => {
    expect(canAddActivity(10)).toBe(false);
    expect(canAddActivity(11)).toBe(false);
  });
});
