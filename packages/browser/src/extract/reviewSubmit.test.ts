import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractReviewSubmit } from './reviewSubmit';

describe('extractReviewSubmit', () => {
  it('extracts fee/submission status exactly, with full confidence', () => {
    const result = extractReviewSubmit(readFixture('college_review_submit_umich'));
    expect(result.confidence).toBe(1);
    expect(result.value).toEqual({ reviewSubmitStatus: 'not_ready', feeStatus: 'unpaid', submissionStatus: 'not_submitted', submittedAt: null });
  });

  it('drops confidence when mangled', () => {
    const mangled = readFixture('college_review_submit_umich').replace(/data-testid/g, 'data-broken');
    const result = extractReviewSubmit(mangled);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
