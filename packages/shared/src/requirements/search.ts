/**
 * Free-text school lookup over the internal dataset, and a couple of human-readable warnings
 * about incompatible plan combinations across a student's list.
 */
import type { ApplicationPlan } from '../domain/enums';
import { SCHOOL_DATASET } from './dataset';
import type { SchoolDatasetEntry } from './types';

const EXACT_SCORE = 100;
const PREFIX_SCORE = 70;
/** Below this, a single top match is not confident enough for `findSchool` to return it alone. */
const CONFIDENT_THRESHOLD = PREFIX_SCORE;

/** Splits into lowercase word tokens, dropping anything shorter than 3 characters — short tokens
 * like "of", "u", or "a" are common enough across school names/aliases to produce noise matches. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function scoreEntry(entry: SchoolDatasetEntry, query: string, queryTokens: string[]): number {
  const q = query.toLowerCase();
  const names = [entry.slug.toLowerCase(), entry.name.toLowerCase(), ...entry.aliases.map((a) => a.toLowerCase())];

  if (names.includes(q)) return EXACT_SCORE;
  if (names.some((n) => n.startsWith(q))) return PREFIX_SCORE;

  const nameTokens = new Set(tokenize(entry.name));
  for (const alias of entry.aliases) for (const t of tokenize(alias)) nameTokens.add(t);
  const overlap = queryTokens.filter((t) => nameTokens.has(t)).length;
  return overlap > 0 ? overlap * 10 : 0;
}

interface RankedEntry {
  entry: SchoolDatasetEntry;
  score: number;
}

function rankSchools(query: string): RankedEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const queryTokens = tokenize(trimmed);
  return SCHOOL_DATASET.map((entry) => ({ entry, score: scoreEntry(entry, trimmed, queryTokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
}

/** Ranked school matches for a free-text query: exact alias/slug/name, then prefix, then token overlap. */
export function findSchools(query: string, limit = 8): SchoolDatasetEntry[] {
  return rankSchools(query)
    .slice(0, limit)
    .map((r) => r.entry);
}

/**
 * The single best match for a free-text query, or `null` when nothing scores high enough (an
 * exact or prefix hit) to be trusted as an unambiguous answer — plain token overlap alone (e.g. a
 * bare word like "state" that appears in several school names) is not confident enough.
 */
export function findSchool(query: string): SchoolDatasetEntry | null {
  const ranked = rankSchools(query);
  const top = ranked[0];
  if (!top || top.score < CONFIDENT_THRESHOLD) return null;
  return top.entry;
}

interface PlannedApplication {
  schoolName: string;
  plan: ApplicationPlan;
}

const BINDING_PLANS = new Set<ApplicationPlan>(['ED', 'ED2']);

function names(apps: PlannedApplication[]): string {
  return apps.map((a) => a.schoolName).join(', ');
}

/**
 * Human-readable warnings about plan combinations that are very likely to violate a school's
 * early-decision or restrictive-early-action agreement. Deliberately generic — the exact rules
 * vary by school, so this flags the combination for the student to double-check, not a verdict.
 */
export function planConflicts(apps: PlannedApplication[]): string[] {
  const warnings: string[] = [];

  const binding = apps.filter((a) => BINDING_PLANS.has(a.plan));
  if (binding.length > 1) {
    warnings.push(
      `More than one binding Early Decision commitment: ${names(binding)}. ED is binding — you can only enroll at one school, and applying ED to more than one at the same time risks both offers being rescinded.`,
    );
  }

  const rea = apps.filter((a) => a.plan === 'REA');
  if (rea.length > 1) {
    warnings.push(
      `More than one Restrictive Early Action commitment: ${names(rea)}. REA is normally single-choice — you can usually apply REA to only one school at a time.`,
    );
  }
  for (const r of rea) {
    const others = apps.filter((a) => a !== r && (a.plan === 'ED' || a.plan === 'ED2' || a.plan === 'EA'));
    if (others.length > 0) {
      warnings.push(
        `REA at ${r.schoolName} usually forbids applying ED or EA elsewhere in the same cycle (${names(others)}); check ${r.schoolName}'s restrictive-early policy before submitting both.`,
      );
    }
  }

  return warnings;
}
