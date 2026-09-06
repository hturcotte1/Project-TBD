'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'apogee-rail';

/** Persisted desktop rail collapse state. Starts expanded on every render (including the client's
 * first one, before localStorage has been consulted) for the same SSR-mismatch reason `useTheme`
 * does — see lib/theme.ts. */
export function useRailCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Private-mode / storage-disabled browsers throw on access; expanded is the safe default.
    }
  }, []);

  const set = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The DOM state already changed; a storage failure just means it won't persist.
    }
  }, []);

  return [collapsed, set];
}
