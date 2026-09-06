import type { Page } from 'playwright';
import type { Shot } from './types';

/**
 * Activity and Admin render their filter/Segmented control before their data has loaded (unlike
 * Settings and Profile, which gate their whole body behind the query), so waiting for the control
 * alone can land the shot before the table or the empty state has painted. Wait for whichever one
 * of the two actually shows up.
 */
async function waitForTableOrEmpty(page: Page, emptyText: string): Promise<void> {
  await page.waitForFunction(
    (text) => document.querySelector('table tbody tr') !== null || (document.body.textContent ?? '').includes(text),
    emptyText,
  );
}

async function waitForActivityLoaded(page: Page): Promise<void> {
  // Segmented renders a Radix ToggleGroup (type="single"), whose root role is "radiogroup", not
  // the generic "group".
  await page.getByRole('radiogroup', { name: 'Filter activity' }).waitFor({ state: 'visible' });
  await waitForTableOrEmpty(page, 'Nothing yet');
}

async function waitForSettingsLoaded(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Notifications' }).waitFor({ state: 'visible' });
}

async function waitForProfileLoaded(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Basics' }).waitFor({ state: 'visible' });
}

async function waitForAdminLoaded(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Admin view' }).waitFor({ state: 'visible' });
  await waitForTableOrEmpty(page, 'No students yet');
}

/** Screens owned by the activity-settings page task. Append entries here; index.ts already imports this file. */
export const SHOTS: Shot[] = [
  { name: 'activity', path: '/activity', prepare: waitForActivityLoaded },
  { name: 'settings', path: '/settings', prepare: waitForSettingsLoaded },
  { name: 'profile', path: '/profile', prepare: waitForProfileLoaded },
  { name: 'admin', path: '/admin', email: 'admin@example.com', prepare: waitForAdminLoaded },
];
