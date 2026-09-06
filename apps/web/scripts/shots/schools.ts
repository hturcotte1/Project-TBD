import type { Shot } from './types';

/** Screens owned by the schools page task. Append entries here; index.ts already imports this file. */
export const SHOTS: Shot[] = [
  {
    name: 'schools',
    path: '/schools',
    // The list is client-fetched; wait for a real row so the shot never lands on the blank
    // instant between navigation and the applications query resolving.
    prepare: async (page) => {
      await page.waitForSelector('tbody tr');
    },
  },
  {
    name: 'schools-expanded',
    path: '/schools',
    prepare: async (page) => {
      await page.locator('tbody tr').first().click();
      await page.waitForSelector('text=Open school');
    },
  },
  {
    name: 'school',
    path: '/schools',
    prepare: async (page) => {
      const origin = new URL(page.url()).origin;
      const response = await page.request.get(`${origin}/api/proxy/applications`);
      const applications = (await response.json()) as { id: string }[];
      const firstId = applications[0]?.id;
      if (!firstId) throw new Error('school shot needs at least one seeded application');
      await page.goto(`${origin}/schools/${firstId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Requirements');
    },
  },
];
