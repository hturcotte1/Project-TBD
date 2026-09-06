import type { Page } from 'playwright';
import type { Shot } from './types';

/**
 * Today fetches everything client-side; wait for the sections that only mount once their query
 * has resolved, so a shot never lands on the loading placeholder. The runner itself waits for the
 * countdown settle before capturing.
 */
async function waitForLoaded(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Queue' }).waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Since yesterday' }).waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Vector' }).waitFor({ state: 'visible' });
}

/** Screens owned by the today page task. Append entries here; index.ts already imports this file. */
export const SHOTS: Shot[] = [
  { name: 'today', path: '/', prepare: waitForLoaded },
  {
    name: 'today-menu',
    path: '/',
    prepare: async (page) => {
      await waitForLoaded(page);
      await page.getByRole('button', { name: /account menu/i }).first().click();
      await page.getByText('Theme').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'palette',
    path: '/',
    prepare: async (page) => {
      await waitForLoaded(page);
      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await dialog.getByPlaceholder(/search schools, essays, people/i).waitFor({ state: 'visible' });
      // The Schools group fetches on open; wait for it before filtering or "mich" filters an
      // empty list and every group (Michigan included) reads as "Nothing matches."
      await dialog.getByText('University of Michigan').first().waitFor({ state: 'visible' });
      await page.keyboard.type('mich');
    },
  },
];
