import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';

// Vitest doesn't expose a global `afterEach` unless `test.globals` is set (it isn't here), so
// @testing-library/react's built-in auto-cleanup never fires — do it explicitly between tests.
afterEach(cleanup);

describe('Button', () => {
  it('throws when iconOnly has no aria-label', () => {
    // The invariant throws during render; silence the React-logged error so the test output
    // stays readable while still asserting the throw itself.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Button iconOnly>Row actions</Button>)).toThrow('Button: iconOnly requires an aria-label');
    consoleError.mockRestore();
  });

  it('renders fine as icon-only once an aria-label is given', () => {
    render(
      <Button iconOnly aria-label="Row actions">
        •
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeTruthy();
  });

  it('disables the button and hides the label while loading', () => {
    render(<Button loading>Sync now</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByText('Sync now')).toBeNull();
  });

  it('is not disabled by default', () => {
    render(<Button>Sync now</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
