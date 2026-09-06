import { describe, expect, it } from 'vitest';
import { buildPrimaryNav, isNavActive } from './nav-items';

describe('buildPrimaryNav', () => {
  it('labels the conversation item with the configured agent name', () => {
    const nav = buildPrimaryNav('Copilot');
    const chat = nav.find((item) => item.href === '/chat');
    expect(chat?.label).toBe('Copilot');
  });

  it('keeps the fixed page order', () => {
    const nav = buildPrimaryNav('Vector');
    expect(nav.map((item) => item.href)).toEqual(['/', '/schools', '/essays', '/recommenders', '/timeline', '/chat', '/activity']);
  });
});

describe('isNavActive', () => {
  it('matches Today only at the exact root', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/', '/schools')).toBe(false);
  });

  it('matches a section and its sub-routes', () => {
    expect(isNavActive('/schools', '/schools')).toBe(true);
    expect(isNavActive('/schools', '/schools/abc-123')).toBe(true);
    expect(isNavActive('/schools', '/schoolsomething')).toBe(false);
  });
});
