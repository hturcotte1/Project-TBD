'use client';

// Keep the storage key and value semantics in sync with the inline THEME_SCRIPT in
// app/layout.tsx, which applies the stored theme before first paint to avoid a flash.
import { useCallback, useEffect, useState } from 'react';

export type ThemeSetting = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'apogee-theme';

/** The stored preference, or 'system' if nothing is stored (or storage isn't available). */
export function readThemeSetting(): ThemeSetting {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private-mode / storage-disabled browsers throw on access; system is the safe default.
  }
  return 'system';
}

/** Applies (or clears) `data-theme` on the root element and persists the choice. 'system' means
 * "follow the OS", which is the CSS default with no attribute set at all. */
export function applyTheme(setting: ThemeSetting): void {
  if (setting === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', setting);
  }
  try {
    if (setting === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // Applying to the DOM already succeeded; a storage failure just means it won't persist.
  }
}

/** React state for the theme setting, backed by localStorage. Every write goes through
 * `applyTheme` so the DOM and storage never drift from the returned state.
 *
 * Starts at 'system' on every render, including the client's very first one, and only reads the
 * real stored value in an effect after mount. A page can be server-rendered with no localStorage
 * to consult, so seeding the initial state from it would make the client's first render disagree
 * with the server's — Radix's roving-focus internals manage some of these attributes imperatively
 * and can leave that specific mismatch unpatched (a real, reproduced bug, not a hypothetical one).
 * The inline THEME_SCRIPT in app/layout.tsx already paints the correct theme before this ever
 * runs, so the only thing delayed a frame is which option this hook reports as selected. */
export function useTheme(): [ThemeSetting, (next: ThemeSetting) => void] {
  const [setting, setSetting] = useState<ThemeSetting>('system');

  useEffect(() => {
    setSetting(readThemeSetting());
  }, []);

  const set = useCallback((next: ThemeSetting) => {
    applyTheme(next);
    setSetting(next);
  }, []);

  return [setting, set];
}
