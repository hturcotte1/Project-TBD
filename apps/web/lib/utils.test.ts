import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a token font size next to a token color', () => {
    expect(cn('text-14 text-fg')).toBe('text-14 text-fg');
    expect(cn('text-fg text-14')).toBe('text-fg text-14');
  });

  it('resolves two font sizes to the last one', () => {
    expect(cn('text-14', 'text-17')).toBe('text-17');
  });

  it('resolves two colors to the last one', () => {
    expect(cn('text-fg-2', 'text-heat-4')).toBe('text-heat-4');
  });

  it('treats the two radii and the one shadow as their own groups', () => {
    expect(cn('rounded rounded-lg')).toBe('rounded-lg');
    expect(cn('shadow-none shadow-float')).toBe('shadow-float');
    expect(cn('font-ui font-count')).toBe('font-count');
  });
});
