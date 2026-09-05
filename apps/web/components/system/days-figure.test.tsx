import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DaysFigure } from './days-figure';

// Vitest doesn't put `afterEach` on the global scope unless `test.globals` is set (it isn't
// here), so @testing-library/react's own auto-cleanup detection never fires — do it explicitly.
afterEach(cleanup);

describe('DaysFigure', () => {
  it('renders a plain number', () => {
    render(<DaysFigure days={12} format="number" />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('renders "today" for zero days', () => {
    render(<DaysFigure days={0} format="number" />);
    expect(screen.getByText('today')).toBeTruthy();
  });

  it('renders an overdue count as "N late"', () => {
    render(<DaysFigure days={-3} format="number" />);
    expect(screen.getByText('3 late')).toBeTruthy();
  });

  it('renders relative phrasing for a future day via lib/format', () => {
    render(<DaysFigure days={12} format="relative" />);
    expect(screen.getByText('in 12 days')).toBeTruthy();
  });

  it('renders relative phrasing for today and an overdue day', () => {
    render(<DaysFigure days={0} format="relative" />);
    expect(screen.getByText('today')).toBeTruthy();
  });

  it('renders relative phrasing for a past day', () => {
    render(<DaysFigure days={-3} format="relative" />);
    expect(screen.getByText('3 days ago')).toBeTruthy();
  });

  it('renders an en dash for no deadline', () => {
    render(<DaysFigure days={null} format="number" />);
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('colors a far deadline as secondary text', () => {
    render(<DaysFigure days={45} format="number" />);
    expect(screen.getByText('45').className).toContain('text-fg-2');
  });

  it('colors an overdue deadline with the top heat step', () => {
    render(<DaysFigure days={-1} format="number" />);
    expect(screen.getByText('1 late').className).toContain('text-heat-5');
  });
});
