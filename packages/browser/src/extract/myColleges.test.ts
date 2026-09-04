import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractMyColleges } from './myColleges';

describe('extractMyColleges', () => {
  it('extracts every college row with full confidence on a clean page', () => {
    const result = extractMyColleges(readFixture('my_colleges'));
    expect(result.confidence).toBe(1);
    expect(result.value).toHaveLength(11);
    const umich = result.value.find((c) => c.name === 'University of Michigan');
    expect(umich).toMatchObject({ common_app_college_id: 'umich', plan: 'EA', deadline: '2026-11-01', questions_status: 'in_progress' });
  });

  it('drops confidence when the row markup is mangled', () => {
    const mangled = readFixture('my_colleges').replace(/data-testid/g, 'data-broken');
    const result = extractMyColleges(mangled);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.value).toEqual([]);
  });
});
