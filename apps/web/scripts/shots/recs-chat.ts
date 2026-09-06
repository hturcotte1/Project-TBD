import type { Shot } from './types';

/** Screens owned by the recs-chat page task. Append entries here; index.ts already imports this file. */
export const SHOTS: Shot[] = [
  {
    name: 'recommenders',
    path: '/recommenders',
    // The list is client-fetched; wait for a real row so the shot never lands on the blank
    // instant between navigation and the recommenders query resolving.
    prepare: async (page) => {
      await page.waitForSelector('tbody tr');
    },
  },
  {
    name: 'recommenders-expanded',
    path: '/recommenders',
    prepare: async (page) => {
      await page.waitForSelector('tbody tr');
      await page.locator('tbody tr').first().click();
      await page.waitForSelector('text=Draft a reminder');
    },
  },
  {
    name: 'vector',
    path: '/chat',
    // The thread is client-polled, not a single query resolving — wait for a real seeded message
    // rather than a fixed delay so the shot never lands on a blank thread.
    prepare: async (page) => {
      await page.waitForSelector('text=hey what should i do first');
    },
  },
];
