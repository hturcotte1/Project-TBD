import type { HeatStep } from '@/lib/urgency';

/** Word count the same way Common App counts: whitespace-separated tokens, empty text is 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/** 0-100 fill for the progress bar. Null when there's no limit to measure against. */
export function wordProgressPercent(count: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((count / limit) * 100));
}

export function isOverWordLimit(count: number, limit: number | null): boolean {
  return limit !== null && count > limit;
}

/** "142 / 250 words" or, with no limit, "142 words". */
export function wordCountLabel(count: number, limit: number | null): string {
  const words = count === 1 ? 'word' : 'words';
  return limit === null ? `${count} ${words}` : `${count} / ${limit} words`;
}

/**
 * The word-count gauge's color step. Only three of the six heat steps are ever used here — this
 * is a three-stage gauge (on track, close, over), not a days-remaining countdown, so it
 * deliberately skips 2 and 4 rather than reusing every step of that scale.
 */
export function wordGaugeStep(count: number, limit: number | null): HeatStep {
  if (limit === null || limit <= 0) return 0;
  if (count > limit) return 5;
  const ratio = count / limit;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 1;
  return 0;
}

/** "180 of 300" or, with no limit, "180" — the compact form for a table cell. */
export function wordsTableLabel(count: number, limit: number | null): string {
  return limit === null ? String(count) : `${count} of ${limit}`;
}

/** "180 of 300 words" / "180 words" / "312 of 300 words, 12 over" — the editor gauge's label. */
export function wordsGaugeLabel(count: number, limit: number | null): string {
  if (limit === null) return `${count} word${count === 1 ? '' : 's'}`;
  if (count > limit) return `${count} of ${limit} words, ${count - limit} over`;
  return `${count} of ${limit} words`;
}
