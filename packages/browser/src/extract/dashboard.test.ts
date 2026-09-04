import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractDashboard } from './dashboard';

describe('extractDashboard', () => {
  it('extracts the heading, college count, and masked account email', () => {
    const result = extractDashboard(readFixture('dashboard'));
    expect(result.confidence).toBe(1);
    expect(result.value.heading).toContain('Dee');
    expect(result.value.collegeSummaryCount).toBe(11);
    expect(result.value.accountEmailMasked).toBe('d***@example.com');
  });
});
