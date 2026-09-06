import type { Page } from 'playwright';

export interface Shot {
  name: string;
  /** A path under BASE_URL, e.g. "/dev/system". */
  path: string;
  /** Runs after navigation and the font-load check, before the screenshot is taken. */
  prepare?: (page: Page) => Promise<void>;
  /** Defaults to false: most pages are captured at the viewport only, not the full scroll height. */
  fullPage?: boolean;
  /** Sign in as this dev account instead of the Demo Student (a new address creates a fresh student). */
  email?: string;
  /** Capture with no session at all (sign-in and dev-login pages). */
  anonymous?: boolean;
}

/** Waits for every finite animation on the page to finish, so a shot never lands mid-settle or mid-fade. */
export async function settle(page: Page): Promise<void> {
  // The countdown numeral counts up with requestAnimationFrame, which getAnimations() cannot see.
  await page.waitForFunction(() => document.querySelector('[data-settling="true"]') === null, undefined, { timeout: 3000 }).catch(() => undefined);
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getTiming();
      return timing !== undefined && timing.iterations !== Infinity;
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    await Promise.race([Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))), timeout]);
  });
}
