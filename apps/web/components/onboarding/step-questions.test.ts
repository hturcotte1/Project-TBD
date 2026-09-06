import { describe, expect, it } from 'vitest';
import { getQuestionCount, getQuestionId, getQuestions } from '@/components/onboarding/step-questions';

describe('getQuestions', () => {
  it('gives every step from 1 to 7 at least one question, in a fixed order', () => {
    for (let step = 1; step <= 7; step += 1) {
      const questions = getQuestions(step);
      expect(questions.length).toBeGreaterThan(0);
      // Ids are unique within a step and every one has a non-empty label.
      expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
      for (const question of questions) expect(question.label.length).toBeGreaterThan(0);
    }
  });

  it('matches the exact count and order the spec lists per step', () => {
    expect(getQuestions(1).map((q) => q.id)).toEqual(['name', 'phone', 'school', 'timezone', 'quiet-hours', 'nudge-intensity']);
    expect(getQuestions(2).map((q) => q.id)).toEqual(['transcript', 'gpa', 'test-scores']);
    expect(getQuestions(3).map((q) => q.id)).toEqual(['resume', 'activities']);
    expect(getQuestions(4).map((q) => q.id)).toEqual(['interview', 'review']);
    expect(getQuestions(5).map((q) => q.id)).toEqual(['majors', 'geography', 'cost', 'demographics', 'schools']);
    expect(getQuestions(6).map((q) => q.id)).toEqual(['connect', 'verify', 'ready']);
    expect(getQuestions(7).map((q) => q.id)).toEqual(['sync']);
  });

  it('returns nothing for a step outside 1-7', () => {
    expect(getQuestions(0)).toEqual([]);
    expect(getQuestions(8)).toEqual([]);
  });
});

describe('getQuestionCount', () => {
  it('counts each step’s questions', () => {
    expect(getQuestionCount(1)).toBe(6);
    expect(getQuestionCount(2)).toBe(3);
    expect(getQuestionCount(3)).toBe(2);
    expect(getQuestionCount(4)).toBe(2);
    expect(getQuestionCount(5)).toBe(5);
    expect(getQuestionCount(6)).toBe(3);
    expect(getQuestionCount(7)).toBe(1);
  });

  it('floors at 1 for an unknown step, so there is always a screen to render', () => {
    expect(getQuestionCount(99)).toBe(1);
  });
});

describe('getQuestionId', () => {
  it('resolves the id at a 1-based index', () => {
    expect(getQuestionId(1, 1)).toBe('name');
    expect(getQuestionId(1, 6)).toBe('nudge-intensity');
    expect(getQuestionId(5, 5)).toBe('schools');
  });

  it('is null outside the step’s range', () => {
    expect(getQuestionId(1, 0)).toBeNull();
    expect(getQuestionId(1, 7)).toBeNull();
  });
});
