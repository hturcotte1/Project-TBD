import { describe, expect, it } from 'vitest';
import { urgencyTone } from '@/lib/urgency';

describe('urgencyTone', () => {
  it('is neutral when there is no deadline', () => {
    expect(urgencyTone(null)).toBe('neutral');
    expect(urgencyTone(undefined)).toBe('neutral');
  });

  it('is critical at 3 days or fewer, including overdue', () => {
    expect(urgencyTone(3)).toBe('critical');
    expect(urgencyTone(1)).toBe('critical');
    expect(urgencyTone(0)).toBe('critical');
    expect(urgencyTone(-2)).toBe('critical');
  });

  it('is warning between 4 and 14 days', () => {
    expect(urgencyTone(4)).toBe('warning');
    expect(urgencyTone(14)).toBe('warning');
  });

  it('is neutral beyond 14 days', () => {
    expect(urgencyTone(15)).toBe('neutral');
    expect(urgencyTone(90)).toBe('neutral');
  });
});
