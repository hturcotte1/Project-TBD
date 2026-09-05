import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Table, TableBody, TableCell, TableRow } from './table';

// Vitest doesn't expose a global `afterEach` unless `test.globals` is set (it isn't here), so
// @testing-library/react's built-in auto-cleanup never fires — do it explicitly between tests.
afterEach(cleanup);

describe('TableRow', () => {
  it('fires onClick when Enter is pressed on an interactive row', () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow interactive onClick={onClick}>
            <TableCell>Ask Ms. Park to submit your Michigan rec</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByText('Ask Ms. Park to submit your Michigan rec').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.keyDown(row as HTMLTableRowElement, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick when Space is pressed on an interactive row', () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow interactive onClick={onClick}>
            <TableCell>Draft the Purdue honors essay</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByText('Draft the Purdue honors essay').closest('tr');
    fireEvent.keyDown(row as HTMLTableRowElement, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores Enter on a non-interactive row', () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onClick={onClick}>
            <TableCell>Confirm your SAT score report for Purdue</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByText('Confirm your SAT score report for Purdue').closest('tr');
    fireEvent.keyDown(row as HTMLTableRowElement, { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('makes an interactive row keyboard-focusable', () => {
    render(
      <Table>
        <TableBody>
          <TableRow interactive onClick={() => {}}>
            <TableCell>Send your Georgia Tech transcript request</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByText('Send your Georgia Tech transcript request').closest('tr');
    expect(row?.getAttribute('tabindex')).toBe('0');
  });
});
