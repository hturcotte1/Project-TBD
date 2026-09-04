import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractTesting } from './testing';

describe('extractTesting', () => {
  it('extracts the self-reported SAT 1450 score with full confidence', () => {
    const result = extractTesting(readFixture('ca_testing'));
    expect(result.confidence).toBe(1);
    expect(result.value.selfReported).toEqual([{ test: 'SAT', score: '1450', date: '2026-06-06' }]);
  });

  it('drops confidence when mangled', () => {
    const mangled = readFixture('ca_testing').replace(/data-testid/g, 'data-broken');
    const result = extractTesting(mangled);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.value.selfReported).toEqual([]);
  });
});
