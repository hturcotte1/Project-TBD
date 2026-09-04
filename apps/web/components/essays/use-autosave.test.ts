import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '@/components/essays/use-autosave';

const DEBOUNCE_MS = 1500;
const RETRY_MS = 5000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('stays "saved" when the content never changes from its initial value', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ content: 'hello', save, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }));
    expect(result.current.status).toBe('saved');
    expect(save).not.toHaveBeenCalled();
  });

  it('goes to "pending" immediately on a change, then saves after the debounce elapses', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ content }) => useAutosave({ content, save, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }), {
      initialProps: { content: 'hello' },
    });

    rerender({ content: 'hello world' });
    expect(result.current.status).toBe('pending');
    expect(save).not.toHaveBeenCalled();

    // Not yet at the debounce boundary.
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('hello world');
    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).not.toBeNull();
  });

  it('debounces: rapid changes reset the timer so only the last value is saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ content }) => useAutosave({ content, save, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }), {
      initialProps: { content: 'a' },
    });

    rerender({ content: 'ab' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ content: 'abc' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(save).not.toHaveBeenCalled();

    rerender({ content: 'abcd' });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('abcd');
  });

  it('goes "offline" when the save fails, then retries after retryMs', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(({ content }) => useAutosave({ content, save, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }), {
      initialProps: { content: 'hello' },
    });

    rerender({ content: 'hello there' });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('offline');

    await act(async () => {
      vi.advanceTimersByTime(RETRY_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('never autosaves while disabled, but picks up the pending change once enabled', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ content, enabled }) => useAutosave({ content, save, enabled, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }), {
      initialProps: { content: 'hello', enabled: false },
    });

    rerender({ content: 'hello there', enabled: false });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS * 2);
      await Promise.resolve();
    });
    expect(save).not.toHaveBeenCalled();

    rerender({ content: 'hello there', enabled: true });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledExactlyOnceWith('hello there');
  });

  it('schedules a follow-up save when content changes again while a save is in flight', async () => {
    let resolveFirst: (() => void) | undefined;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ content }) => useAutosave({ content, save, debounceMs: DEBOUNCE_MS, retryMs: RETRY_MS }), {
      initialProps: { content: 'hello' },
    });

    rerender({ content: 'hello there' });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    expect(result.current.status).toBe('saving');

    // Editor keeps changing while the first save is in flight.
    rerender({ content: 'hello there friend' });

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    // The first save resolved for the stale value; a new save is now scheduled, not yet fired.
    expect(save).toHaveBeenCalledExactlyOnceWith('hello there');
    expect(result.current.status).toBe('pending');

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('hello there friend');
  });
});
