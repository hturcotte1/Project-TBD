'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * `pending` and `saving` both render as "Saving…" in the UI — the distinction exists so tests can
 * tell "waiting out the debounce" apart from "request in flight".
 */
export type AutosaveStatus = 'saved' | 'pending' | 'saving' | 'offline';

export interface AutosaveState {
  status: AutosaveStatus;
  savedAt: Date | null;
}

export interface UseAutosaveOptions {
  /** The current text to keep saved. */
  content: string;
  /** Persists `content`. Reject/throw to signal a failed save (offline, server error, ...). */
  save: (content: string) => Promise<void>;
  /** Idle time after the last change before an autosave fires. */
  debounceMs?: number;
  /** How long to wait before retrying after a failed save. */
  retryMs?: number;
  /** Set false to pause autosaving entirely (e.g. before the initial draft has loaded). */
  enabled?: boolean;
}

const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_RETRY_MS = 5000;

/**
 * Debounced autosave for the essay editor: `debounceMs` after `content` stops changing, saves it
 * and tracks saved/saving/pending/offline status. A failed save retries automatically after
 * `retryMs`. If `content` changes again while a save is in flight, another save is scheduled the
 * moment the first one settles, so a burst of typing never leaves an edit unsaved.
 */
export function useAutosave({ content, save, debounceMs = DEFAULT_DEBOUNCE_MS, retryMs = DEFAULT_RETRY_MS, enabled = true }: UseAutosaveOptions): AutosaveState {
  const [state, setState] = useState<AutosaveState>({ status: 'saved', savedAt: null });

  const contentRef = useRef(content);
  contentRef.current = content;
  const savedRef = useRef(content);
  const saveRef = useRef(save);
  saveRef.current = save;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function schedule(delay: number) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void attemptSave();
      }, delay);
    }

    async function attemptSave() {
      if (inFlightRef.current) return;
      const toSave = contentRef.current;
      if (toSave === savedRef.current) {
        setState((prev) => (prev.status === 'pending' ? { ...prev, status: 'saved' } : prev));
        return;
      }
      inFlightRef.current = true;
      setState((prev) => ({ ...prev, status: 'saving' }));
      try {
        await saveRef.current(toSave);
        savedRef.current = toSave;
        inFlightRef.current = false;
        if (contentRef.current !== toSave) {
          setState({ status: 'pending', savedAt: new Date() });
          schedule(debounceMs);
        } else {
          setState({ status: 'saved', savedAt: new Date() });
        }
      } catch {
        inFlightRef.current = false;
        setState((prev) => ({ ...prev, status: 'offline' }));
        schedule(retryMs);
      }
    }

    if (!enabled) return clearTimer;
    if (content === savedRef.current) return clearTimer;
    setState((prev) => (prev.status === 'saving' ? prev : { ...prev, status: 'pending' }));
    schedule(debounceMs);
    return clearTimer;
  }, [content, enabled, debounceMs, retryMs]);

  return state;
}
