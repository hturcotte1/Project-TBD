import * as cheerio from 'cheerio';
import type { AnyNode, Cheerio, CheerioAPI } from 'cheerio';

/** The shape every extractor returns for a piece of extracted data (mirrors `@tbd/shared`'s `Extracted`). */
export interface ExtractedResult<T> {
  value: T;
  confidence: number;
  raw: string;
}

const RAW_MAX = 4000;

/** Builds an `ExtractedResult`, clamping confidence to [0,1] and raw text to the shared schema's cap. */
export function makeExtracted<T>(value: T, confidence: number, raw: string): ExtractedResult<T> {
  return { value, confidence: Math.max(0, Math.min(1, confidence)), raw: raw.length > RAW_MAX ? raw.slice(0, RAW_MAX) : raw };
}

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/** Fraction of `selectors` that matched at least one element in `$` — the extractor's confidence. */
export function anchorConfidence($: CheerioAPI, selectors: string[]): number {
  if (selectors.length === 0) return 1;
  const found = selectors.filter((sel) => {
    try {
      return $(sel).length > 0;
    } catch {
      return false;
    }
  }).length;
  return found / selectors.length;
}

export function text($el: Cheerio<AnyNode>): string {
  return $el.first().text().trim();
}

/** Empty string -> null, since a page renders "no value" as an empty text node, not absence. */
export function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Coerces free text into one of a closed set of values, falling back rather than guessing. */
export function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const trimmed = value.trim() as T;
  return (allowed as readonly string[]).includes(trimmed) ? trimmed : fallback;
}

/** Same as `asEnum`, but for fields where "not one of the known values" should become null. */
export function asEnumOrNull<T extends string>(value: string, allowed: readonly T[]): T | null {
  const trimmed = value.trim() as T;
  return (allowed as readonly string[]).includes(trimmed) ? trimmed : null;
}

export function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function toFloatOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function toBool(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Guards a date-shaped field before it reaches a zod `IsoDate` schema — bad text becomes null. */
export function toIsoDateOrNull(value: string | null): string | null {
  if (value === null) return null;
  return ISO_DATE_RE.test(value.trim()) ? value.trim() : null;
}

/** "demo@example.com" -> "d***@example.com". Never log or store the full address unmasked. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** Caps a whole document's text for a `raw` field when no single anchor is a good representative. */
export function bodyRaw($: CheerioAPI): string {
  return $('body').text().replace(/\s+/g, ' ').trim();
}
