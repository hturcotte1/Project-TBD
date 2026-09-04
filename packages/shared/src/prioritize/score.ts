import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { IsoDate } from '../schemas/common';
import type { PrioritizeApplication, PrioritizeItem } from './types';

/**
 * Deterministic scoring. Every weight below is a named constant so the ranking can be explained
 * and tuned without hunting through arithmetic. The final score is:
 *
 *   score = (urgency + dependency + effort + blocking) * importance
 *
 * i.e. four additive components describing *why* an item matters right now, scaled by one
 * multiplier describing *how much* this item matters overall. `parts.importance` is that
 * multiplier (1.0 at the baseline importance), not an additive term.
 */

// ---- urgency: grows sharply as the deadline nears; overdue and "due tomorrow or sooner" both cap out. ----
/** Ceiling of the urgency component (also the value used for "no known deadline at all"). */
const URGENCY_MAX = 40;
/** Days remaining at/under which urgency is already maxed out (covers "due today" and overdue). */
const URGENCY_IMMEDIATE_DAYS = 1;
/**
 * Controls how fast urgency falls off with distance. Using days-past-immediate as `d`,
 * urgency = MAX / (1 + d / DECAY) — a convex curve: small at 60+ days out, moderate around a
 * month out, high inside a week, and maxed out inside a day (or overdue).
 */
const URGENCY_DECAY_DAYS = 14;
/** Items with neither their own due date nor an application deadline to borrow: flat, low urgency. */
const URGENCY_NO_DEADLINE = URGENCY_MAX * 0.1;

function urgencyFromDays(daysRemaining: number): number {
  if (daysRemaining <= URGENCY_IMMEDIATE_DAYS) return URGENCY_MAX;
  const d = daysRemaining - URGENCY_IMMEDIATE_DAYS;
  return URGENCY_MAX / (1 + d / URGENCY_DECAY_DAYS);
}

// ---- dependency: items waiting on someone else are pulled forward, as if their deadline were sooner. ----
/**
 * A recommender (or counselor, or testing agency) needs lead time to act, and the student can't
 * force the pace — so a `dependsOnOthers` item is scored as if it were this many days closer to
 * its deadline than it really is. The bonus is the resulting *extra* urgency (never negative),
 * which is largest in the middle of the horizon and fades out both very close to the deadline
 * (both readings are already near the urgency ceiling) and very far from it (neither matters yet).
 */
const DEPENDENCY_LEAD_DAYS = 10;

function dependencyBonus(dependsOnOthers: boolean, daysRemaining: number, urgency: number): number {
  if (!dependsOnOthers) return 0;
  const pulledForward = urgencyFromDays(daysRemaining - DEPENDENCY_LEAD_DAYS);
  return Math.max(0, pulledForward - urgency);
}

// ---- effort: small tasks get boosted near the deadline (quick wins), large tasks get boosted early. ----
const EFFORT_BOOST_MAX = 15;
/** Steady mid-value for medium-effort items: never the top priority for timing, never the last. */
const EFFORT_MEDIUM_BOOST = EFFORT_BOOST_MAX * 0.5;

function effortBoost(effort: PrioritizeItem['effort'], closeness: number): number {
  switch (effort) {
    case 'small':
      // Close to the deadline (closeness -> 1), small tasks are cheap wins: boost them.
      return EFFORT_BOOST_MAX * closeness;
    case 'large':
      // Far from the deadline (closeness -> 0), large tasks (essays) need a head start: boost them.
      return EFFORT_BOOST_MAX * (1 - closeness);
    case 'medium':
      return EFFORT_MEDIUM_BOOST;
  }
}

// ---- blocking: FERPA releases, required supplements, and anything else that gates other work. ----
const BLOCKING_BONUS = 25;

// ---- importance: multiplies the whole thing. Baseline importance (50, the DB default) => 1.0x. ----
const IMPORTANCE_BASELINE = 50;
/** Floor so a low-importance item still ranks (near the bottom), rather than always scoring zero. */
const IMPORTANCE_MIN_FACTOR = 0.2;

function importanceFactor(importance: number): number {
  return Math.max(importance / IMPORTANCE_BASELINE, IMPORTANCE_MIN_FACTOR);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** The date an item is actually judged against: its own due date, else the application's deadline. */
export function effectiveDueDate(item: PrioritizeItem, application: PrioritizeApplication | null): IsoDate | null {
  return item.dueDate ?? application?.deadline ?? null;
}

/**
 * Calendar days from `today` to `date` (0 = same day, negative = `date` is in the past).
 * Both arguments are plain YYYY-MM-DD strings already resolved to the student's local calendar
 * by the caller, so this is ordinary calendar arithmetic, not timezone math.
 */
export function calendarDaysBetween(today: IsoDate, date: IsoDate): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

export interface ScoreParts {
  urgency: number;
  dependency: number;
  effort: number;
  blocking: number;
  /** Multiplier applied to the sum of the other four parts, not an additive term. */
  importance: number;
}

export interface ScoreResult {
  score: number;
  parts: ScoreParts;
}

export function scoreItem(item: PrioritizeItem, application: PrioritizeApplication | null, today: IsoDate): ScoreResult {
  const dueDate = effectiveDueDate(item, application);
  const daysRemaining = dueDate === null ? null : calendarDaysBetween(today, dueDate);

  const urgency = daysRemaining === null ? URGENCY_NO_DEADLINE : urgencyFromDays(daysRemaining);
  const dependency = daysRemaining === null ? 0 : dependencyBonus(item.dependsOnOthers, daysRemaining, urgency);
  const closeness = urgency / URGENCY_MAX;
  const effort = effortBoost(item.effort, closeness);
  const blocking = item.blocking ? BLOCKING_BONUS : 0;
  const importance = importanceFactor(item.importance);

  const score = round3((urgency + dependency + effort + blocking) * importance);

  return { score, parts: { urgency: round3(urgency), dependency: round3(dependency), effort: round3(effort), blocking, importance } };
}
