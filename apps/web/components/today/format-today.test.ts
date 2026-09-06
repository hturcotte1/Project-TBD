import { describe, expect, it } from 'vitest';
import { formatLongDate } from './format-today';

describe('formatLongDate', () => {
  it('renders the long weekday and month with no year', () => {
    expect(formatLongDate('2026-09-05', 'America/Chicago')).toBe('Saturday, September 5');
  });

  it('resolves in the given timezone, not the machine local zone', () => {
    expect(formatLongDate('2026-01-01', 'Pacific/Kiritimati')).toBe('Thursday, January 1');
  });
});
