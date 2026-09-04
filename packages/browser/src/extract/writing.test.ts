import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractWriting } from './writing';

describe('extractWriting', () => {
  it('extracts prompt 5, 412 words, in_progress, with full confidence', () => {
    const result = extractWriting(readFixture('ca_writing'));
    expect(result.confidence).toBe(1);
    expect(result.value.status).toBe('in_progress');
    expect(result.value.promptIndex).toBe(5);
    expect(result.value.wordCount).toBe(412);
    expect(result.value.essayText).toContain("Rosa's Taqueria");
  });

  it('drops confidence when mangled', () => {
    const mangled = readFixture('ca_writing').replace(/data-testid/g, 'data-broken');
    const result = extractWriting(mangled);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.value.status).toBe('unknown');
  });
});
