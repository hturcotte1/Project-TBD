import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Countdown } from './countdown';

// Vitest doesn't expose a global `afterEach` unless `test.globals` is set (it isn't here), so
// @testing-library/react's built-in auto-cleanup never fires — do it explicitly between tests.
afterEach(cleanup);

describe('Countdown', () => {
  it('renders the final value immediately when settle is false', () => {
    render(<Countdown days={57} size="page" settle={false} />);
    expect(screen.getByText('57')).toBeTruthy();
  });

  it('renders an en dash with no deadline', () => {
    render(<Countdown days={null} size="row" />);
    expect(screen.getByText('–')).toBeTruthy();
  });

  it('has an aria-label with the day count', () => {
    render(<Countdown days={57} size="page" settle={false} />);
    expect(screen.getByLabelText('57 days')).toBeTruthy();
  });

  it('labels the no-deadline case for screen readers', () => {
    render(<Countdown days={null} size="row" />);
    expect(screen.getByLabelText('no deadline')).toBeTruthy();
  });

  it('shows an overdue count as a positive number, not a negative one', () => {
    render(<Countdown days={-3} size="row" settle={false} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByText('-3')).toBeNull();
  });

  it('renders the caller-supplied label sentence', () => {
    render(<Countdown days={57} size="page" settle={false} label="days until Michigan, Early Action." />);
    expect(screen.getByText('days until Michigan, Early Action.')).toBeTruthy();
  });
});
