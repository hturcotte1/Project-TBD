import type { BrowserContext, Page } from 'playwright';

export interface BrowserSessionHandle {
  id: string;
  provider: 'local' | 'browserbase';
  page: Page;
  context: BrowserContext;
  /** A human-viewable session replay URL (Browserbase only); null for local Chromium. */
  replayUrl: string | null;
  /** Serialized Playwright storage state (cookies + localStorage), for resuming later. */
  storageState(): Promise<string>;
  close(): Promise<void>;
}

export interface BrowserSessionProvider {
  readonly provider: 'local' | 'browserbase';
  open(opts: { studentId: string; storageStateJson?: string | null }): Promise<BrowserSessionHandle>;
}
