import { randomUUID } from 'node:crypto';
import Browserbase from '@browserbasehq/sdk';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserSessionHandle, BrowserSessionProvider } from './types';

/** The shape `context.storageState()` returns; also what `context.addCookies()` needs the `cookies` slice of. */
type StorageStateData = Awaited<ReturnType<BrowserContext['storageState']>>;

class BrowserbaseSessionHandle implements BrowserSessionHandle {
  readonly provider = 'browserbase' as const;

  constructor(
    readonly id: string,
    private readonly client: Browserbase,
    private readonly bbSessionId: string,
    private readonly projectId: string,
    private readonly browser: Browser,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly replayUrl: string,
  ) {}

  async storageState(): Promise<string> {
    return JSON.stringify(await this.context.storageState());
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
    await this.browser.close().catch(() => undefined);
    // Releases the Browserbase session promptly instead of waiting out its timeout/keepAlive.
    await this.client.sessions.update(this.bbSessionId, { status: 'REQUEST_RELEASE', projectId: this.projectId }).catch(() => undefined);
  }
}

export interface BrowserbaseSessionProviderOptions {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
}

/**
 * Production provider: a real remote Chromium session hosted by Browserbase, connected to over
 * CDP. `keepAlive: true` so a paused verification-code job can resume in the same session; the
 * worker holds the connection open in-process for the whole wait (see DECISIONS.md #8).
 *
 * NOT EXERCISED IN THIS SANDBOX: no Browserbase API key is available here. Verified against the
 * SDK's published types (`@browserbasehq/sdk`) rather than a live account — see the package report.
 */
export class BrowserbaseSessionProvider implements BrowserSessionProvider {
  readonly provider = 'browserbase' as const;
  private readonly client: Browserbase;

  constructor(private readonly opts: BrowserbaseSessionProviderOptions) {
    this.client = new Browserbase({ apiKey: opts.apiKey, ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}) });
  }

  async open(opts: { studentId: string; storageStateJson?: string | null }): Promise<BrowserSessionHandle> {
    const session = await this.client.sessions.create({
      projectId: this.opts.projectId,
      keepAlive: true,
      userMetadata: { studentId: opts.studentId },
    });

    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());

    if (opts.storageStateJson) {
      const state = JSON.parse(opts.storageStateJson) as StorageStateData;
      if (state.cookies.length > 0) await context.addCookies(state.cookies);
    }

    const page = context.pages()[0] ?? (await context.newPage());
    const replayUrl = `https://www.browserbase.com/sessions/${session.id}`;
    return new BrowserbaseSessionHandle(randomUUID(), this.client, session.id, this.opts.projectId, browser, context, page, replayUrl);
  }
}
