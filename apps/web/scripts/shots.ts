import type { Page } from 'playwright';

export interface Shot {
  name: string;
  /** A path under BASE_URL, e.g. "/dev/system". */
  path: string;
  /** Runs after navigation and the font-load check, before the screenshot is taken. */
  prepare?: (page: Page) => Promise<void>;
  /** Defaults to false: most pages are captured at the viewport only, not the full scroll height. */
  fullPage?: boolean;
}

// Other agents append their own screens here as they migrate pages onto the component system —
// the screenshot script itself never needs to change to pick up a new entry.
/** The page-size Countdown's settle animation runs for 600ms on mount; without this, the shot's
 * exact timing (font checks, network idle) makes it a coin flip whether it lands mid-count. */
async function waitForCountdownSettle(page: Page): Promise<void> {
  await page.waitForTimeout(700);
}

export const SHOTS: Shot[] = [
  { name: 'system', path: '/dev/system', fullPage: true, prepare: waitForCountdownSettle },
  {
    name: 'system-palette',
    path: '/dev/system',
    fullPage: true,
    prepare: async (page) => {
      await waitForCountdownSettle(page);
      await page.keyboard.press('Control+k');
      // Matches only the palette's own input — the plain Input demo elsewhere on the page has the
      // shorter placeholder "Search schools", which this pattern deliberately excludes.
      await page.getByPlaceholder(/search schools, essays/i).waitFor({ state: 'visible' });
    },
  },
];
