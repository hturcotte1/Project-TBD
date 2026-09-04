import type { BrowserContext, Page } from 'playwright';
import { FORBIDDEN_ACTION_PATTERNS } from './commonapp-map';

/** URLs allowed to be *navigated to* (read-only) even though their slug matches a forbidden word. */
const READ_ONLY_URL_ALLOWLIST: RegExp[] = [/\/review-submit(?:$|[/?#])/i, /\/review_submit(?:$|[/?#])/i];

export class SubmitGuardError extends Error {
  constructor(
    message: string,
    readonly matched: { pattern: string; field: 'selector' | 'text' | 'url'; value: string },
  ) {
    super(message);
    this.name = 'SubmitGuardError';
  }
}

function matchOrThrow(value: string, field: 'selector' | 'text' | 'url'): void {
  for (const pattern of FORBIDDEN_ACTION_PATTERNS) {
    if (pattern.test(value)) {
      throw new SubmitGuardError(`blocked unsafe action: ${field} "${value}" matched forbidden pattern ${pattern}`, {
        pattern: pattern.source,
        field,
        value,
      });
    }
  }
}

/**
 * The always-on submit/payment guard. Every mutating `SafePage` method calls this with the
 * selector it is about to act on and the element's visible text; `SafePage.goto` calls it with
 * the destination URL. Throws `SubmitGuardError` on any match — there is no override, no config
 * flag, and no autonomy level that disables it (see DECISIONS.md #16: level C would relax the
 * *submit job kind* for `review_submit_status`-adjacent approvals, never this runtime check).
 *
 * The one narrow exception: navigating (read-only) to a college's review-and-completion page is
 * allowed even though its URL slug contains "submit", because this package must be able to read
 * that page's status badges (see `commonapp-map.ts`, `college_review_submit`). Clicking or filling
 * anything on that page is still blocked, because `selector`/`text` are never exempted — only `url`.
 */
export function assertSafeAction(input: { selector?: string; text?: string; url?: string }): void {
  if (input.selector !== undefined) matchOrThrow(input.selector, 'selector');
  if (input.text !== undefined) matchOrThrow(input.text, 'text');
  if (input.url !== undefined && !READ_ONLY_URL_ALLOWLIST.some((re) => re.test(input.url as string))) {
    matchOrThrow(input.url, 'url');
  }
}

export interface SafePageClickOptions {
  timeout?: number;
}

/**
 * Wraps a Playwright `Page` so every mutating call is guarded. Reading (`content`, `screenshot`,
 * `locator`, `waitFor`) is unrestricted — extraction and audit need to see the whole page,
 * including a review page's submit button, without ever being able to click it.
 */
export class SafePage {
  constructor(private readonly page: Page) {}

  get context(): BrowserContext {
    return this.page.context();
  }

  /** The underlying Playwright page, for read-only use only (e.g. handing to Stagehand). */
  get raw(): Page {
    return this.page;
  }

  url(): string {
    return this.page.url();
  }

  async goto(url: string, opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    assertSafeAction({ url });
    await this.page.goto(url, opts);
  }

  async content(): Promise<string> {
    return this.page.content();
  }

  async screenshot(): Promise<Buffer> {
    return this.page.screenshot({ type: 'png' });
  }

  locator(selector: string): ReturnType<Page['locator']> {
    return this.page.locator(selector);
  }

  async waitFor(selector: string, opts?: { timeout?: number }): Promise<void> {
    await this.page.locator(selector).first().waitFor({ state: 'visible', timeout: opts?.timeout });
  }

  private async visibleTextOf(selector: string): Promise<string> {
    try {
      return await this.page.locator(selector).first().innerText({ timeout: 2000 });
    } catch {
      return '';
    }
  }

  async click(selector: string, opts?: SafePageClickOptions): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().click({ timeout: opts?.timeout });
  }

  async fill(selector: string, value: string): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().fill(value);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().selectOption(value);
  }

  async check(selector: string): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().check();
  }

  async uncheck(selector: string): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().uncheck();
  }

  async press(selector: string, key: string): Promise<void> {
    const visibleText = await this.visibleTextOf(selector);
    assertSafeAction({ selector, text: visibleText, url: this.page.url() });
    await this.page.locator(selector).first().press(key);
  }
}
