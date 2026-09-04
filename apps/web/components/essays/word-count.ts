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
