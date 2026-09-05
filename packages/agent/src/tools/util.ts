import type * as S from '@apogee/shared/db/schema';
import type { ItemKind } from '@apogee/shared/domain';

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

const STOPWORDS = new Set([
  'done', 'with', 'the', 'my', 'for', 'i', 'im', 'ive', 'finished', 'finish', 'submitted', 'submit', 'sent', 'complete',
  'completed', 'just', 'a', 'an', 'on', 'of', 'to', 'and', 'is', 'that', 'this', 'it', 'all', 'up', 'now', 'today',
]);

/** Words students use for an item kind. */
const KIND_WORDS: Record<string, ItemKind[]> = {
  supp: ['supplement_essay'],
  supps: ['supplement_essay'],
  supplement: ['supplement_essay'],
  supplements: ['supplement_essay'],
  essay: ['supplement_essay', 'personal_essay'],
  essays: ['supplement_essay', 'personal_essay'],
  personal: ['personal_essay'],
  rec: ['teacher_rec', 'counselor_rec', 'other_rec'],
  recs: ['teacher_rec', 'counselor_rec', 'other_rec'],
  recommendation: ['teacher_rec', 'counselor_rec', 'other_rec'],
  letter: ['teacher_rec', 'counselor_rec', 'other_rec'],
  letters: ['teacher_rec', 'counselor_rec', 'other_rec'],
  counselor: ['counselor_rec'],
  teacher: ['teacher_rec'],
  fafsa: ['fafsa'],
  css: ['css_profile'],
  fee: ['application_fee', 'fee_waiver'],
  waiver: ['fee_waiver'],
  transcript: ['transcript'],
  interview: ['interview'],
  portfolio: ['portfolio'],
  questions: ['college_questions'],
  scores: ['score_send', 'test_scores'],
  sat: ['score_send'],
  act: ['score_send'],
  ferpa: ['ferpa'],
  midyear: ['midyear_report'],
  activities: ['common_app_section'],
  testing: ['common_app_section'],
  profile: ['common_app_section'],
  family: ['common_app_section'],
  education: ['common_app_section'],
};

export interface MatchableItem {
  id: string;
  title: string;
  kind: ItemKind;
  schoolName: string | null;
}

export type ItemMatch<T> = { kind: 'match'; item: T } | { kind: 'ambiguous'; candidates: T[] } | { kind: 'none' };

/**
 * Match a student's phrase ("the Georgetown supp", "my Michigan teacher rec", "fafsa") to one open
 * item. A school name alone never picks an arbitrary item at that school: the phrase must also
 * describe the item (a title word or a kind word), and near-ties are reported as ambiguous.
 */
export function matchItem<T extends MatchableItem>(query: string, items: readonly T[]): ItemMatch<T> {
  const tokens = normalizeForMatch(query).split(' ').filter((t) => t && !STOPWORDS.has(t));
  if (tokens.length === 0) return { kind: 'none' };

  const schoolTokens = new Set<string>();
  for (const item of items) {
    if (!item.schoolName) continue;
    for (const w of normalizeForMatch(item.schoolName).split(' ')) {
      if (w.length > 2 && tokens.includes(w) && !['university', 'college', 'the'].includes(w)) schoolTokens.add(w);
    }
  }
  const descriptor = tokens.filter((t) => !schoolTokens.has(t));

  const scored = items
    .map((item) => {
      const titleWords = normalizeForMatch(item.title).split(' ').filter(Boolean);
      const school = item.schoolName ? normalizeForMatch(item.schoolName) : '';
      const schoolHit = schoolTokens.size === 0 ? true : [...schoolTokens].some((t) => school.includes(t));
      if (!schoolHit) return { item, score: 0 };
      let score = schoolTokens.size > 0 ? 20 : 0;
      let described = false;
      for (const t of descriptor) {
        if (titleWords.includes(t)) {
          score += 30;
          described = true;
        }
        const kinds = KIND_WORDS[t];
        if (kinds?.includes(item.kind)) {
          score += 25;
          described = true;
        }
      }
      if (descriptor.length > 0 && normalizeForMatch(item.title) === descriptor.join(' ')) score += 50;
      return { item, score: described ? score : 0 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: 'none' };
  const top = scored[0]!;
  const runnerUp = scored[1];
  if (runnerUp && top.score - runnerUp.score < 10) {
    return { kind: 'ambiguous', candidates: scored.filter((s) => top.score - s.score < 10).map((s) => s.item) };
  }
  return { kind: 'match', item: top.item };
}
