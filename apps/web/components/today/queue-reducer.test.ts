import { describe, expect, it } from 'vitest';
import { moveQueueSelection, resolveActionHref } from './queue-reducer';

describe('moveQueueSelection', () => {
  it('lands on the first row moving forward from nothing selected', () => {
    expect(moveQueueSelection(null, 1, 5)).toBe(0);
  });

  it('lands on the last row moving backward from nothing selected', () => {
    expect(moveQueueSelection(null, -1, 5)).toBe(4);
  });

  it('wraps from the last row to the first moving forward', () => {
    expect(moveQueueSelection(4, 1, 5)).toBe(0);
  });

  it('wraps from the first row to the last moving backward', () => {
    expect(moveQueueSelection(0, -1, 5)).toBe(4);
  });

  it('moves one step at a time in the middle of the list', () => {
    expect(moveQueueSelection(1, 1, 5)).toBe(2);
    expect(moveQueueSelection(2, -1, 5)).toBe(1);
  });

  it('returns null for an empty queue', () => {
    expect(moveQueueSelection(null, 1, 0)).toBeNull();
    expect(moveQueueSelection(0, 1, 0)).toBeNull();
  });
});

describe('resolveActionHref', () => {
  it('targets the school page when an application is linked', () => {
    expect(resolveActionHref({ application_id: 'app-1' })).toBe('/schools/app-1');
  });

  it('does nothing when there is no linked application', () => {
    expect(resolveActionHref({ application_id: null })).toBeNull();
  });
});
