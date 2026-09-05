import { describe, expect, it } from 'vitest';
import { HEAT_TEXT_CLASSES, heatStep, heatTextClass } from './urgency';

describe('heatStep', () => {
  it('is silent with no deadline or more than 30 days out', () => {
    expect(heatStep(null)).toBe(0);
    expect(heatStep(undefined)).toBe(0);
    expect(heatStep(31)).toBe(0);
    expect(heatStep(120)).toBe(0);
  });

  it('heats up in six steps', () => {
    expect(heatStep(30)).toBe(1);
    expect(heatStep(15)).toBe(1);
    expect(heatStep(14)).toBe(2);
    expect(heatStep(8)).toBe(2);
    expect(heatStep(7)).toBe(3);
    expect(heatStep(4)).toBe(3);
    expect(heatStep(3)).toBe(4);
    expect(heatStep(0)).toBe(4);
    expect(heatStep(-1)).toBe(5);
  });

  it('maps to a text class and never a background', () => {
    expect(heatTextClass(2)).toBe('text-heat-4');
    expect(heatTextClass(null)).toBe('text-fg-2');
    for (const cls of Object.values(HEAT_TEXT_CLASSES)) expect(cls.startsWith('text-')).toBe(true);
  });
});
