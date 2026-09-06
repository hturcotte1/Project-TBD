import { describe, expect, it } from 'vitest';
import { countWords, isOverWordLimit, wordCountLabel, wordGaugeStep, wordProgressPercent, wordsGaugeLabel, wordsTableLabel } from '@/components/essays/word-count';

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

describe('wordGaugeStep', () => {
  it('is 0 with no limit, regardless of count', () => {
    expect(wordGaugeStep(10_000, null)).toBe(0);
  });

  it('is 0 under 70% of the limit', () => {
    expect(wordGaugeStep(0, 300)).toBe(0);
    expect(wordGaugeStep(209, 300)).toBe(0);
  });

  it('is 1 from 70% up to (but under) 90%', () => {
    expect(wordGaugeStep(210, 300)).toBe(1);
    expect(wordGaugeStep(269, 300)).toBe(1);
  });

  it('is 3 from 90% through the limit itself', () => {
    expect(wordGaugeStep(270, 300)).toBe(3);
    expect(wordGaugeStep(300, 300)).toBe(3);
  });

  it('is 5 once strictly over the limit', () => {
    expect(wordGaugeStep(301, 300)).toBe(5);
  });
});

describe('wordsTableLabel', () => {
  it('shows just the count with no limit', () => {
    expect(wordsTableLabel(180, null)).toBe('180');
  });

  it('shows "count of limit" when a limit exists, even over it', () => {
    expect(wordsTableLabel(180, 300)).toBe('180 of 300');
    expect(wordsTableLabel(312, 300)).toBe('312 of 300');
  });
});

describe('wordsGaugeLabel', () => {
  it('shows "N words" with no limit', () => {
    expect(wordsGaugeLabel(180, null)).toBe('180 words');
    expect(wordsGaugeLabel(1, null)).toBe('1 word');
  });

  it('shows "count of limit words" within the limit', () => {
    expect(wordsGaugeLabel(180, 300)).toBe('180 of 300 words');
    expect(wordsGaugeLabel(300, 300)).toBe('300 of 300 words');
  });

  it('appends how many words over once past the limit', () => {
    expect(wordsGaugeLabel(312, 300)).toBe('312 of 300 words, 12 over');
  });
});
