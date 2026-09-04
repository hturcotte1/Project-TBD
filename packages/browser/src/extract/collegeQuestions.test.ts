import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractCollegeQuestions } from './collegeQuestions';

describe('extractCollegeQuestions', () => {
  it('extracts a complete college (UChicago) with its intended major', () => {
    const result = extractCollegeQuestions(readFixture('college_questions_uchicago'));
    expect(result.confidence).toBe(1);
    expect(result.value.status).toBe('complete');
    expect(result.value.answers.q_intended_major).toBe('economics');
  });

  it('extracts a not-started college (Purdue) with empty answers', () => {
    const result = extractCollegeQuestions(readFixture('college_questions_purdue'));
    expect(result.value.status).toBe('not_started');
    expect(result.value.answers).toEqual({ q_intended_major: '', q_additional_info: '' });
  });

  it('drops confidence when mangled', () => {
    const mangled = readFixture('college_questions_umich').replace(/data-testid/g, 'data-broken').replace(/name="q_/g, 'data-broken-name="q_');
    const result = extractCollegeQuestions(mangled);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
