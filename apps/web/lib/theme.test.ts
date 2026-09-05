import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, readThemeSetting } from './theme';

const STORAGE_KEY = 'apogee-theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('readThemeSetting', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readThemeSetting()).toBe('system');
  });

  it('reads a stored dark or light preference', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    expect(readThemeSetting()).toBe('dark');
    localStorage.setItem(STORAGE_KEY, 'light');
    expect(readThemeSetting()).toBe('light');
  });

  it('falls back to system for a value it does not recognize', () => {
    localStorage.setItem(STORAGE_KEY, 'blue');
    expect(readThemeSetting()).toBe('system');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and persists an explicit choice', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('clears data-theme and storage for system', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
