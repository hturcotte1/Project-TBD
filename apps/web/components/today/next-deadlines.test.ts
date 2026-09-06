import { describe, expect, it } from 'vitest';
import { buildThenSentence } from './next-deadlines';

describe('buildThenSentence', () => {
  it('is null with no following deadlines', () => {
    expect(buildThenSentence([])).toBeNull();
  });

  it('reads as one clause with a single following deadline', () => {
    expect(buildThenSentence([{ schoolName: 'Purdue', daysRemaining: 60 }])).toBe('Then Purdue in 60.');
  });

  it('joins two following deadlines with "and"', () => {
    expect(
      buildThenSentence([
        { schoolName: 'Georgia Tech', daysRemaining: 59 },
        { schoolName: 'Purdue', daysRemaining: 60 },
      ]),
    ).toBe('Then Georgia Tech in 59 and Purdue in 60.');
  });
});
