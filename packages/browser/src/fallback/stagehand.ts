import type { Env } from '@apogee/shared/config';
import type { Logger } from '@apogee/shared/logging';
// Stagehand v4 bundles its own zod 4.4.3 and types `extract()`'s schema parameter against that
// exact package, not any zod-4-compatible lookalike. The environment notes for this task suggest
// `zod/v4` (the forward-compatible v4 API zod 3.25 ships at that subpath) — that *runs* fine, but
// its ZodType predates methods (`toJSONSchema`, `encode`, `decode`, ...) 4.4.3 added, so it fails
// to typecheck against Stagehand's overloads. `zod-stagehand` (package.json: `npm:zod@4.4.3`,
// pinned to the exact version `@browserbasehq/stagehand` itself depends on) resolves to the same
// physical package pnpm already installs for Stagehand, so the types are identical, not just
// compatible. See DECISIONS.md #7 and the package report for more on this.
import type { z as z4 } from 'zod-stagehand';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';
import type { BrowserSessionHandle } from '../session/types';

export interface PageExtractorFallback {
  /**
   * Asks a model to read the live page and fill `schema` when the deterministic cheerio
   * extractor for `sectionName` reported low confidence (site drift). `instruction` must describe
   * what to *read*, never an action — see `guard.ts`; this path never clicks or fills anything.
   */
  extractSection<T>(sectionName: string, instruction: string, schema: z4.ZodType<T>, session: BrowserSessionHandle): Promise<{ value: T; confidence: number }>;
}

/**
 * Stagehand has no notion of "confidence" for an `extract()` call (see the SDK's `ExtractResult`
 * type — only cache/usage metadata). This fixed value says "trust this more than the low-
 * confidence deterministic read it is replacing, but not as much as a clean selector match" —
 * callers (`client.ts`) only prefer a fallback result when it beats the extractor's own score.
 */
export const STAGEHAND_FALLBACK_CONFIDENCE = 0.75;

/** Matches Env's default `LLM_DEFAULT_MODEL` ("claude-sonnet-5") — see @apogee/shared/config/env.ts. */
const STAGEHAND_MODEL_NAME = 'anthropic/claude-sonnet-5' as const;

/**
 * Reconnects to the *same* Browserbase session (over CDP, by session id) that the deterministic
 * reader used, so a fallback read sees exactly the page state the writer/reader left behind.
 *
 * NOT EXERCISED IN THIS SANDBOX: no Browserbase or Anthropic keys are available here. Built and
 * typechecked against `@browserbasehq/stagehand`'s and `@browserbasehq/sdk`'s published types —
 * see the package report for what a human should verify against a live account before relying on it.
 */
export class StagehandExtractor implements PageExtractorFallback {
  constructor(
    private readonly opts: { browserbaseApiKey: string; browserbaseBaseUrl: string; anthropicApiKey: string },
    private readonly logger?: Logger,
  ) {}

  async extractSection<T>(sectionName: string, instruction: string, schema: z4.ZodType<T>, session: BrowserSessionHandle): Promise<{ value: T; confidence: number }> {
    if (session.provider !== 'browserbase') {
      throw new Error(`StagehandExtractor requires a Browserbase session (got "${session.provider}"); local-CDP fallback is not implemented — see the package report`);
    }
    this.logger?.info({ sectionName }, 'stagehand fallback: extracting low-confidence section');

    const browser = await browserbase.connect({
      apiKey: this.opts.browserbaseApiKey,
      baseUrl: this.opts.browserbaseBaseUrl,
      sessionId: session.id,
    });
    const stagehand = await Stagehand.create({
      browser,
      model: { modelName: STAGEHAND_MODEL_NAME, apiKey: this.opts.anthropicApiKey },
    });
    try {
      const result = await stagehand.extract(instruction, schema);
      return { value: result.data, confidence: STAGEHAND_FALLBACK_CONFIDENCE };
    } finally {
      await stagehand.close().catch(() => undefined);
    }
  }
}

/** Returns null unless `STAGEHAND_FALLBACK` is on and every key it needs is present. */
export function createFallbackExtractor(env: Env, logger?: Logger): PageExtractorFallback | null {
  if (!env.STAGEHAND_FALLBACK) return null;
  if (!env.ANTHROPIC_API_KEY || !env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
    logger?.warn('STAGEHAND_FALLBACK is on but ANTHROPIC_API_KEY/BROWSERBASE_API_KEY/BROWSERBASE_PROJECT_ID are not all set; fallback disabled');
    return null;
  }
  return new StagehandExtractor({
    browserbaseApiKey: env.BROWSERBASE_API_KEY,
    browserbaseBaseUrl: 'https://api.browserbase.com',
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });
}
