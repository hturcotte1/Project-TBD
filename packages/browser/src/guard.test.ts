import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FORBIDDEN_ACTION_PATTERNS } from './commonapp-map';
import { assertSafeAction, SafePage, SubmitGuardError } from './guard';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, '.');

describe('assertSafeAction', () => {
  it('throws for a forbidden selector', () => {
    expect(() => assertSafeAction({ selector: '[data-testid="submit-application-button"]' })).toThrow(SubmitGuardError);
  });

  it('throws for forbidden visible text', () => {
    expect(() => assertSafeAction({ text: 'Submit Application' })).toThrow(SubmitGuardError);
    expect(() => assertSafeAction({ text: 'Pay application fee' })).toThrow(SubmitGuardError);
    expect(() => assertSafeAction({ text: 'Review and Submit' })).toThrow(SubmitGuardError);
  });

  it('does not throw for innocuous selectors/text', () => {
    expect(() => assertSafeAction({ selector: 'input[name="first_name"]', text: 'Legal first name' })).not.toThrow();
    // "payload" and "submitted" must never false-positive on the bare "pay"/"submit" patterns.
    expect(() => assertSafeAction({ text: 'fillFields payload', selector: '[data-testid="recommender-status"]' })).not.toThrow();
    expect(() => assertSafeAction({ text: 'Ms. Park submitted your recommendation' })).not.toThrow();
  });

  it('blocks a URL that matches a forbidden word, except the review-page read-only allowlist', () => {
    expect(() => assertSafeAction({ url: 'http://localhost:4100/checkout' })).toThrow(SubmitGuardError);
    expect(() => assertSafeAction({ url: 'http://localhost:4100/college/umich/review-submit' })).not.toThrow();
  });

  it('still blocks a click on the review page even though navigating there is allowed', () => {
    // The url is allowlisted, but selector/text are independent checks and are never exempted.
    expect(() =>
      assertSafeAction({ url: 'http://localhost:4100/college/umich/review-submit', selector: '[data-testid="submit-application-button"]', text: 'Submit Application' }),
    ).toThrow(SubmitGuardError);
  });
});

describe('SafePage', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('click() throws SubmitGuardError for a button whose visible text is "Submit application", even with an innocuous selector', async () => {
    await page.setContent('<button id="ok-button" type="button">Submit application</button>');
    const safePage = new SafePage(page);
    await expect(safePage.click('#ok-button')).rejects.toThrow(SubmitGuardError);
  });

  it('click() does not throw for an innocuous button', async () => {
    await page.setContent('<button id="save-button" type="button">Save</button>');
    const safePage = new SafePage(page);
    await expect(safePage.click('#save-button')).resolves.not.toThrow();
  });

  it('fill() throws SubmitGuardError when the target selector itself names a forbidden action', async () => {
    await page.setContent('<input id="fee-payment-submit" type="text" />');
    const safePage = new SafePage(page);
    await expect(safePage.fill('#fee-payment-submit', 'x')).rejects.toThrow(SubmitGuardError);
  });
});

// ---- Grep-level test: no selector/text literal targeting a forbidden action lives outside the guard ----

/**
 * Recursively collects every `.ts` file under `src/`, excluding:
 *  - `guard.ts` and `commonapp-map.ts` (the FORBIDDEN_ACTION_PATTERNS list itself, and the one
 *    file allowed to record a "submit" selector, for reading only — see its notes),
 *  - `mock/**` (the mock IS the untrusted external site stand-in: its review-and-completion page
 *    must contain a real "Submit Application" button and its rendered content legitimately
 *    contains words like "fee" — see its route notes. What this test guards is the client/writer
 *    never hardcoding a matching selector or instruction; scanning the fixture site it drives
 *    against would be testing the wrong thing),
 *  - `*.test.ts` files (including this one).
 */
function collectScannedFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(SRC_DIR, full);
    if (statSync(full).isDirectory()) {
      if (rel === 'mock') continue;
      out.push(...collectScannedFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue;
    if (rel === 'guard.ts' || rel === 'commonapp-map.ts') continue;
    out.push(full);
  }
  return out;
}

/** Characters after which a `/` starts a regex literal rather than being division/an operator. */
const REGEX_CONTEXT_CHARS = new Set('([{,;:=&|!?+-*%^~<>'.split(''));

/**
 * Extracts the contents of every string/template/regex literal in `source`, skipping comments.
 * Regex literals are scanned (and their matched text discarded, not treated as a "literal" to
 * check) purely so their internal `/`, `'`, and `"` characters never desynchronize the quote
 * scanner below — e.g. `replace(/value="[^"]*"/g, ...)` has quote characters *inside* the regex.
 */
function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  let i = 0;
  const n = source.length;
  let lastMeaningful = ''; // last non-whitespace, non-comment character seen, for regex-vs-division
  while (i < n) {
    const c = source[i] as string;

    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let j = i + 1;
      let buf = '';
      while (j < n && source[j] !== quote) {
        if (source[j] === '\\') {
          buf += (source[j] ?? '') + (source[j + 1] ?? '');
          j += 2;
          continue;
        }
        buf += source[j];
        j++;
      }
      literals.push(buf);
      i = j + 1;
      lastMeaningful = quote;
      continue;
    }
    if (c === '/' && REGEX_CONTEXT_CHARS.has(lastMeaningful)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n && source[j] !== '\n') {
        const cj = source[j];
        if (cj === '\\') {
          j += 2;
          continue;
        }
        if (cj === '[') {
          inClass = true;
          j++;
          continue;
        }
        if (cj === ']') {
          inClass = false;
          j++;
          continue;
        }
        if (cj === '/' && !inClass) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < n && /[a-z]/i.test(source[j] as string)) j++;
        i = j;
        lastMeaningful = '/';
        continue;
      }
      // Not actually a regex literal (never closed before end of line) — treat "/" as an
      // ordinary character (division) and keep scanning normally from the next character.
    }
    lastMeaningful = c;
    i++;
  }
  return literals;
}

describe('grep-level: no forbidden selector/text literal outside the guard', () => {
  const files = collectScannedFiles(SRC_DIR);

  it('scanned at least the extractors, client, and session files (the check itself is not vacuous)', () => {
    const relPaths = files.map((f) => relative(SRC_DIR, f));
    expect(relPaths).toContain('client.ts');
    expect(relPaths).toContain('diff.ts');
    expect(relPaths.some((p) => p.startsWith('extract/'))).toBe(true);
    expect(relPaths.some((p) => p.startsWith('session/'))).toBe(true);
  });

  for (const file of files) {
    const rel = relative(SRC_DIR, file);
    it(`${rel} contains no string literal matching a forbidden action pattern`, () => {
      const literals = extractStringLiterals(readFileSync(file, 'utf-8'));
      for (const literal of literals) {
        for (const pattern of FORBIDDEN_ACTION_PATTERNS) {
          expect(pattern.test(literal), `"${rel}" has a string literal "${literal}" matching ${pattern}`).toBe(false);
        }
      }
    });
  }
});
