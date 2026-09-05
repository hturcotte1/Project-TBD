import { describe, expect, it } from 'vitest';
import { fingerprintValue, redactLongVerification } from './client';

describe('fill verification redaction', () => {
  it('leaves short values alone', () => {
    const v = { path: 'activities[0].position', expected: 'Editor-in-Chief', observed: 'Editor-in-Chief', matched: true };
    expect(redactLongVerification(v)).toEqual(v);
  });
  it('replaces essay prose with a fingerprint but keeps the match verdict', () => {
    const essay = 'word '.repeat(300).trim();
    const v = { path: 'writing.personal_essay', expected: essay, observed: essay, matched: true };
    const r = redactLongVerification(v);
    expect(r.matched).toBe(true);
    expect(r.expected).not.toContain('word word');
    expect(r.expected).toMatch(/^\[300 words, \d+ chars, sha256:[0-9a-f]{12}\]$/);
    expect(r.observed).toBe(fingerprintValue(essay));
  });
  it('fingerprints any long value regardless of path', () => {
    const long = 'x'.repeat(201);
    const r = redactLongVerification({ path: 'questions.q_additional_info', expected: long, observed: null, matched: false });
    expect(r.expected.startsWith('[')).toBe(true);
    expect(r.observed).toBeNull();
  });
});
