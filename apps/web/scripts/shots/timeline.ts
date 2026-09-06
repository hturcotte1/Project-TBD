import type { Shot } from './types';

/** Screens owned by the timeline page task. Append entries here; index.ts already imports this file. */
export const SHOTS: Shot[] = [
  {
    name: 'timeline',
    path: '/timeline',
    // Client-fetched: wait for the agenda's first table so the shot never lands before the
    // timeline query resolves.
    prepare: async (page) => {
      await page.waitForSelector('table');
    },
  },
  {
    name: 'timeline-deadlines',
    path: '/timeline?kind=application_deadline',
    prepare: async (page) => {
      // Waits for the Deadlines segment to actually be selected (not just present) — the filter
      // state syncs from the URL a tick after mount, and the shot must land after that lands too.
      await page.waitForSelector('button[role="radio"][aria-checked="true"]:has-text("Deadlines")');
    },
  },
];
