import { describe, expect, it } from 'vitest';
import { countWords, isOverWordLimit, wordCountLabel, wordProgressPercent } from '@/components/essays/word-count';

describe('countWords', () => {
  it('is zero for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });

  it('counts whitespace-separated words', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  leading and trailing  ')).toBe(3);
  });

  it('collapses runs of whitespace, including newlines, into one boundary', () => {
    expect(countWords('one\n\ntwo   three')).toBe(3);
  });
});

describe('wordProgressPercent', () => {
  it('is null with no limit', () => {
    expect(wordProgressPercent(500, null)).toBeNull();
  });

  it('computes a proportional fill', () => {
    expect(wordProgressPercent(125, 250)).toBe(50);
    expect(wordProgressPercent(0, 250)).toBe(0);
  });

  it('caps at 100 once over the limit', () => {
    expect(wordProgressPercent(400, 250)).toBe(100);
  });
});

describe('isOverWordLimit', () => {
  it('is false with no limit', () => {
    expect(isOverWordLimit(10_000, null)).toBe(false);
  });

  it('is true only strictly over the limit', () => {
    expect(isOverWordLimit(250, 250)).toBe(false);
    expect(isOverWordLimit(251, 250)).toBe(true);
  });
});

describe('wordCountLabel', () => {
  it('shows just the count with no limit', () => {
    expect(wordCountLabel(412, null)).toBe('412 words');
  });

  it('shows count over limit', () => {
    expect(wordCountLabel(143, 250)).toBe('143 / 250 words');
  });

  it('singularizes "word" for a count of exactly one', () => {
    expect(wordCountLabel(1, null)).toBe('1 word');
  });
});
