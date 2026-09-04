import type * as S from '@tbd/shared/db/schema';

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.includes(q)) return 85;
  if (q.includes(c)) return 70;
  const qWords = new Set(q.split(' '));
  const cWords = c.split(' ').filter(Boolean);
  const overlap = cWords.filter((w) => qWords.has(w)).length;
  return overlap > 0 ? (overlap / Math.max(qWords.size, cWords.length)) * 60 : 0;
}

/** Fuzzy best match of `query` against `items` by a derived searchable string. Null if nothing scores. */
export function bestMatch<T>(query: string, items: readonly T[], textOf: (item: T) => string): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreMatch(query, textOf(item));
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

export function matchesSchoolName(query: string, name: string): boolean {
  const q = normalizeForMatch(query);
  const n = normalizeForMatch(name);
  return q.length > 0 && (n === q || n.includes(q) || q.includes(n));
}

export function matchesSchool(query: string, school: S.School): boolean {
  return [school.name, school.slug, ...school.aliases].some((candidate) => matchesSchoolName(query, candidate));
}
