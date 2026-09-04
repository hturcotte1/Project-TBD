import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserSessionHandle, BrowserSessionProvider } from './types';

/** The shape `context.storageState()` returns and `newContext({ storageState })` accepts. */
type StorageStateData = Awaited<ReturnType<BrowserContext['storageState']>>;

class LocalSessionHandle implements BrowserSessionHandle {
  readonly provider = 'local' as const;
  readonly replayUrl = null;

  constructor(
    readonly id: string,
    private readonly browser: Browser,
    readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  async storageState(): Promise<string> {
    return JSON.stringify(await this.context.storageState());
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
    await this.browser.close().catch(() => undefined);
  }
}

export interface LocalChromiumSessionProviderOptions {
  /** Explicit Chromium binary — required in this sandbox, where Playwright's bundled build is absent. */
  executablePath?: string;
  headless?: boolean;
}

/** Dev/test provider: a real headless Chromium on this machine, no Browserbase account needed. */
export class LocalChromiumSessionProvider implements BrowserSessionProvider {
  readonly provider = 'local' as const;

  constructor(private readonly opts: LocalChromiumSessionProviderOptions = {}) {}

  async open(opts: { studentId: string; storageStateJson?: string | null }): Promise<BrowserSessionHandle> {
    const browser = await chromium.launch({
      headless: this.opts.headless ?? true,
      executablePath: this.opts.executablePath,
    });
    const storageState: StorageStateData | undefined = opts.storageStateJson ? (JSON.parse(opts.storageStateJson) as StorageStateData) : undefined;
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    return new LocalSessionHandle(randomUUID(), browser, context, page);
  }
}
