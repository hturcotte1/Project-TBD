import type { NextActionDto } from '@apogee/shared/api';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueueTable } from './queue-table';

afterEach(cleanup);

function fakeAction(id: string): NextActionDto {
  return {
    id,
    application_item_id: null,
    application_id: `app-${id}`,
    school_name: 'Michigan',
    action: `Action ${id}`,
    reason: 'Because it is next.',
    priority_score: 1,
    rank: 1,
    due_date: null,
    days_remaining: 5,
    status: 'open',
    snoozed_until: null,
    updated_at: '2026-09-05T00:00:00.000Z',
  };
}

describe('QueueTable keyboard navigation', () => {
  it('pressing j twice then Enter calls the open handler for the third row', () => {
    const actions = [fakeAction('1'), fakeAction('2'), fakeAction('3')];
    const onOpen = vi.fn();
    render(<QueueTable actions={actions} onOpen={onOpen} onDone={vi.fn()} onSnooze={vi.fn()} />);

    // Row 1 is selected by default; j moves to row 2, j again moves to row 3.
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(actions[2]);
  });

  it('wraps k from the first row to the last, then s snoozes it', () => {
    const actions = [fakeAction('1'), fakeAction('2'), fakeAction('3')];
    const onSnooze = vi.fn();
    render(<QueueTable actions={actions} onOpen={vi.fn()} onDone={vi.fn()} onSnooze={onSnooze} />);

    fireEvent.keyDown(window, { key: 'k' });
    fireEvent.keyDown(window, { key: 's' });

    expect(onSnooze).toHaveBeenCalledWith(actions[2], 1);
  });
});
