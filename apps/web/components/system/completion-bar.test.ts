import { describe, expect, it } from 'vitest';
import { segmentWidths } from './completion-bar';

describe('segmentWidths', () => {
  it("splits width proportionally to each group's total", () => {
    const result = segmentWidths([
      { label: 'Forms', done: 4, total: 4 },
      { label: 'Essays', done: 1, total: 3 },
      { label: 'Recommendations', done: 0, total: 2 },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]?.widthPercent).toBeCloseTo((4 / 9) * 100);
    expect(result[1]?.widthPercent).toBeCloseTo((3 / 9) * 100);
    expect(result[2]?.widthPercent).toBeCloseTo((2 / 9) * 100);
  });

  it('skips groups with a zero total, both in count and in the width split', () => {
    const result = segmentWidths([
      { label: 'Forms', done: 0, total: 0 },
      { label: 'Essays', done: 1, total: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Essays');
    expect(result[0]?.widthPercent).toBe(100);
  });

  it('returns an empty array when every group is zero-total', () => {
    expect(segmentWidths([{ label: 'Forms', done: 0, total: 0 }])).toEqual([]);
  });

  it('returns an empty array for no groups at all', () => {
    expect(segmentWidths([])).toEqual([]);
  });
});
