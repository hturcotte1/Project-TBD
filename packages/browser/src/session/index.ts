import type { Env } from '@tbd/shared/config';
import { BrowserbaseSessionProvider } from './browserbase';
import { LocalChromiumSessionProvider } from './local';
import type { BrowserSessionProvider } from './types';

export { BrowserbaseSessionProvider, type BrowserbaseSessionProviderOptions } from './browserbase';
export { LocalChromiumSessionProvider, type LocalChromiumSessionProviderOptions } from './local';
export type { BrowserSessionHandle, BrowserSessionProvider } from './types';

/** Picks the session provider from `Env.BROWSER_PROVIDER` (see `config/env.ts` in @tbd/shared). */
export function createBrowserSessionProvider(env: Env): BrowserSessionProvider {
  if (env.BROWSER_PROVIDER === 'browserbase') {
    if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
      throw new Error('BROWSER_PROVIDER=browserbase requires BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID');
    }
    return new BrowserbaseSessionProvider({ apiKey: env.BROWSERBASE_API_KEY, projectId: env.BROWSERBASE_PROJECT_ID });
  }
  return new LocalChromiumSessionProvider({ executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
}
