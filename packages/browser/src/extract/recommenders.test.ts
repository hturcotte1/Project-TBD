import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractRecommenders } from './recommenders';

describe('extractRecommenders', () => {
  it('extracts Michigan FERPA, counselor, and teachers exactly, with full confidence', () => {
    const result = extractRecommenders(readFixture('college_recommenders_umich'));
    expect(result.confidence).toBe(1);
    expect(result.value.ferpaStatus).toBe('complete');
    expect(result.value.counselor).toMatchObject({ name: 'Mr. Diaz', role: 'counselor', status: 'invited', invitedAt: '2026-09-01' });
    expect(result.value.teachers).toEqual([
      { name: 'Ms. Park', role: 'teacher', subject: 'AP English Language', status: 'invited', invitedAt: '2026-09-02', submittedAt: null },
      { name: 'Mr. Okafor', role: 'teacher', subject: 'AP Physics', status: 'submitted', invitedAt: '2026-08-28', submittedAt: '2026-09-01' },
    ]);
  });

  it('is fully confident about a college with no recommenders invited yet (UIUC)', () => {
    const result = extractRecommenders(readFixture('college_recommenders_uiuc'));
    expect(result.value.counselor).toBeNull();
    expect(result.value.teachers).toEqual([]);
    expect(result.confidence).toBe(1);
  });

  it('drops confidence when mangled', () => {
    const mangled = readFixture('college_recommenders_umich').replace(/data-testid/g, 'data-broken');
    const result = extractRecommenders(mangled);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
