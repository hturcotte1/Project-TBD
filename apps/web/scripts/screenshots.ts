/**
 * Captures every entry in scripts/shots/*.ts at 390px and 1280px, in dark and light, against a
 * running app (`pnpm start` or `pnpm dev`). See docs/screenshots for output and the project's
 * spec for the full contract — this is the tool other agents run after they migrate a page onto
 * the component system, not a test suite in itself.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { SHOTS, settle } from './shots/index';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_OUT_DIR = '/home/user/Project-TBD/docs/screenshots';
const DEV_EMAIL = 'demo@example.com';

type Theme = 'dark' | 'light';
type Width = '390' | '1280';

interface Args {
  only?: string;
  themes: Theme[];
  widths: Width[];
  outDir: string;
}

const VIEWPORTS: Record<Width, { width: number; height: number; deviceScaleFactor: number }> = {
  '390': { width: 390, height: 844, deviceScaleFactor: 2 },
  '1280': { width: 1280, height: 800, deviceScaleFactor: 1 },
};

function parseArgs(argv: string[]): Args {
  let only: string | undefined;
  let theme: 'dark' | 'light' | 'both' = 'both';
  let width: Width | 'both' = 'both';
  let outDir = process.env.OUT_DIR || DEFAULT_OUT_DIR;

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--only') {
      if (value === undefined) throw new Error('--only requires a value');
      only = value;
      i += 1;
    } else if (flag === '--theme') {
      if (value !== 'dark' && value !== 'light' && value !== 'both') throw new Error(`--theme must be dark, light or both, got "${value}"`);
      theme = value;
      i += 1;
    } else if (flag === '--width') {
      if (value !== '390' && value !== '1280' && value !== 'both') throw new Error(`--width must be 390, 1280 or both, got "${value}"`);
      width = value;
      i += 1;
    } else if (flag === '--out') {
      if (value === undefined) throw new Error('--out requires a value');
      outDir = value;
      i += 1;
    }
  }

  return {
    only,
    themes: theme === 'both' ? ['dark', 'light'] : [theme],
    widths: width === 'both' ? ['390', '1280'] : [width],
    outDir,
  };
}

/** Signs in once per context by POSTing the dev login form directly (no page navigation needed)
 * and copying the resulting session cookie into the context's cookie jar. */
async function signIn(context: BrowserContext, email: string): Promise<void> {
  await context.clearCookies();
  const response = await context.request.post(`${BASE_URL}/dev/session`, {
    form: { email, redirect_url: '/' },
    maxRedirects: 0,
  });

  const headers = await response.headersArray();
  const setCookie = headers.find((header) => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('apogee_dev_session='));
  if (!setCookie) {
    throw new Error(`dev sign-in at ${BASE_URL}/dev/session did not return an apogee_dev_session cookie (status ${response.status()})`);
  }
  const rest = setCookie.value.slice('apogee_dev_session='.length);
  const value = rest.includes(';') ? rest.slice(0, rest.indexOf(';')) : rest;

  await context.addCookies([{ name: 'apogee_dev_session', value, domain: new URL(BASE_URL).hostname, path: '/' }]);
}

/** Both families are self-hosted via next/font/local, which hashes the generated CSS family name
 * but keeps a readable "hanken"/"bricolage" fragment in it — this is the signal that the real
 * fonts loaded rather than a system fallback silently standing in for them. */
async function assertFontsLoaded(page: Page): Promise<void> {
  const loadedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    const families: string[] = [];
    document.fonts.forEach((face) => {
      if (face.status === 'loaded') families.push(face.family);
    });
    return families;
  });

  const matches = loadedFamilies.filter((family) => /hanken|bricolage/i.test(family));
  if (matches.length < 2) {
    throw new Error(`expected at least two loaded hanken/bricolage font faces, found: ${JSON.stringify(loadedFamilies)}`);
  }
  console.log(`Fonts loaded: ${matches.join(', ')}`);
}

async function captureContext(browser: Browser, theme: Theme, width: Width, outDir: string, shots: typeof SHOTS): Promise<string[]> {
  const viewport = VIEWPORTS[width];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
  });

  const written: string[] = [];
  try {
    // Set before any navigation so the app's own theme-init script (see app/layout.tsx) picks it
    // up on first paint, same as a real returning visitor.
    await context.addInitScript((value: string) => {
      try {
        window.localStorage.setItem('apogee-theme', value);
      } catch {
        // Storage can be unavailable in a locked-down context; the app falls back to system theme.
      }
    }, theme);
    // Each shot names its own account (or none); the cookie jar is swapped only when that changes.
    let sessionEmail: string | null = null;
    const page = await context.newPage();
    for (const shot of shots) {
      const wanted = shot.anonymous ? null : (shot.email ?? DEV_EMAIL);
      if (wanted !== sessionEmail) {
        if (wanted === null) await context.clearCookies();
        else await signIn(context, wanted);
        sessionEmail = wanted;
      }
      await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });
      await assertFontsLoaded(page);
      if (shot.prepare) await shot.prepare(page);
      await settle(page);

      const fileName = `${shot.name}-${width}-${theme}.png`;
      const filePath = path.join(outDir, fileName);
      await page.screenshot({ path: filePath, fullPage: shot.fullPage ?? false });
      written.push(filePath);
      console.log(`Wrote ${filePath}`);
    }
  } finally {
    await context.close();
  }
  return written;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { only } = args;
  const shots = only ? SHOTS.filter((shot) => shot.name.includes(only)) : SHOTS;
  if (shots.length === 0) {
    throw new Error(`--only "${only}" matched no shots (known: ${SHOTS.map((s) => s.name).join(', ')})`);
  }

  await mkdir(args.outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const failures: string[] = [];
  const written: string[] = [];

  try {
    for (const theme of args.themes) {
      for (const width of args.widths) {
        try {
          written.push(...(await captureContext(browser, theme, width, args.outDir, shots)));
        } catch (error) {
          failures.push(`${theme}/${width}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${written.length} screenshot(s) to ${args.outDir}`);

  if (failures.length > 0) {
    console.error(`${failures.length} failure(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
