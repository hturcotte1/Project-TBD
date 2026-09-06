import { describe, expect, it } from 'vitest';
import { tidyNextActionText } from './next-action-text';

describe('tidyNextActionText', () => {
  it('drops a trailing " — it is due in N days." clause', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay — it is due in 57 days.')).toBe('Stanford ED: Personal essay');
  });

  it('drops a trailing ", it is due in N days." clause', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay, it is due in 12 days.')).toBe('Stanford ED: Personal essay');
  });

  it('handles the singular "day"', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay — it is due in 1 day.')).toBe('Stanford ED: Personal essay');
  });

  it('replaces spaced em dashes with commas elsewhere in the text', () => {
    expect(tidyNextActionText('Finish the essay — final draft')).toBe('Finish the essay, final draft');
  });

  it('replaces every em dash, not just the first', () => {
    expect(tidyNextActionText('A — B — C')).toBe('A, B, C');
  });

  it('leaves a dependency clause after the due clause alone (only replaces its dash)', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay — it is due in 57 days, and it depends on someone else acting first.')).toBe(
      'Stanford ED: Personal essay, it is due in 57 days, and it depends on someone else acting first.',
    );
  });

  it('leaves an overdue reason alone apart from the dash', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay — it was due 3 days ago.')).toBe('Stanford ED: Personal essay, it was due 3 days ago.');
  });

  it('leaves a no-deadline reason alone apart from the dash', () => {
    expect(tidyNextActionText('Stanford ED: Personal essay — no deadline is on file yet.')).toBe(
      'Stanford ED: Personal essay, no deadline is on file yet.',
    );
  });

  it('is a no-op on text with no dash and no due clause', () => {
    expect(tidyNextActionText('Finish the FAFSA')).toBe('Finish the FAFSA');
  });
});
