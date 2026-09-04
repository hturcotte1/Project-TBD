import { OPEN_ITEM_STATUSES, calendarDaysBetween } from '../prioritize';
import type { TriggerEvent } from '../schemas/proactive';
import { daysUntil, localDate, localDayOfWeek, localHour, localTime, weekStartOf } from '../time/dates';
import type { TriggerApplication, TriggerState } from './types';

/** Local hour at/after which any nudge is allowed to go out (never in the middle of the night). */
const MORNING_START_HOUR = 9;

const DEADLINE_COUNTDOWN_DAYS = [30, 14, 7, 3, 1] as const;
const DEADLINE_COUNTDOWN_PRIORITY: Record<number, number> = { 30: 15, 14: 30, 7: 55, 3: 75, 1: 90 };
const DEADLINE_DAY_OF_PRIORITY = 100;

const RECOMMENDER_INACTIVITY_MIN_DAYS_SINCE_INVITE = 14;
const RECOMMENDER_INACTIVITY_DEADLINE_WINDOW_DAYS = 21;
const RECOMMENDER_INACTIVITY_PRIORITY = 60;

const ESSAY_STALE_MIN_DAYS_SINCE_EDIT = 5;
const ESSAY_STALE_DEADLINE_WINDOW_DAYS = 30;
const ESSAY_STALENESS_PRIORITY = 45;

const SCORE_SEND_CUTOFF_DAYS = 3;
const SCORE_SEND_CUTOFF_PRIORITY = 65;

const MORNING_PLAN_WINDOW_START = '07:30';
const MORNING_PLAN_WINDOW_END = '09:00';
const MORNING_PLAN_PRIORITY = 40;

const WEEKLY_PLAN_WINDOW_START = '18:00';
const WEEKLY_PLAN_PRIORITY = 50;

const OPEN_APPLICATION_STATUSES = new Set<TriggerApplication['status']>(['not_started', 'in_progress', 'ready_to_submit']);

function countOpenItems(items: TriggerState['items'], applicationId: string): number {
  return items.filter((i) => i.applicationId === applicationId && OPEN_ITEM_STATUSES.has(i.status)).length;
}

/**
 * Deterministic proactive trigger rules. Every event carries a stable `trigger_key`; the caller
 * skips any key already present in `state.sentTriggerKeys`, so re-evaluating on every scheduler
 * tick never re-fires a nudge that already went out. No I/O, no randomness, no wall-clock reads —
 * `now` is the only source of time.
 */
export function evaluateTriggers(state: TriggerState, now: Date): TriggerEvent[] {
  const { student } = state;
  if (student.onboardingCompletedAt === null) return [];

  const tz = student.timezone;
  const today = localDate(now, tz);
  const hour = localHour(now, tz);
  const time = localTime(now, tz);
  const events: TriggerEvent[] = [];

  const emit = (key: string, build: () => TriggerEvent): void => {
    if (state.sentTriggerKeys.has(key)) return;
    events.push(build());
  };

  const applicationsById = new Map(state.applications.map((a) => [a.id, a] as const));

  // ---- deadline countdown + day-of ----
  for (const app of state.applications) {
    if (!OPEN_APPLICATION_STATUSES.has(app.status)) continue;
    const daysRemaining = daysUntil(app.deadline, now, tz);
    const openItems = countOpenItems(state.items, app.id);
    const facts = { school: app.schoolName, plan: app.plan, deadline: app.deadline, days_remaining: daysRemaining, open_items: openItems };

    if (hour >= MORNING_START_HOUR && (DEADLINE_COUNTDOWN_DAYS as readonly number[]).includes(daysRemaining)) {
      const key = `deadline_countdown:${app.id}:${daysRemaining}`;
      emit(key, () => ({
        kind: 'deadline_countdown',
        trigger_key: key,
        application_id: app.id,
        application_item_id: null,
        recommender_id: null,
        essay_id: null,
        due_date: app.deadline,
        days_remaining: daysRemaining,
        facts,
        always_send: false,
        priority: DEADLINE_COUNTDOWN_PRIORITY[daysRemaining] ?? 50,
      }));
    }

    if (daysRemaining === 0 && hour >= MORNING_START_HOUR) {
      const key = `deadline_day_of:${app.id}`;
      emit(key, () => ({
        kind: 'deadline_day_of',
        trigger_key: key,
        application_id: app.id,
        application_item_id: null,
        recommender_id: null,
        essay_id: null,
        due_date: app.deadline,
        days_remaining: 0,
        facts,
        always_send: true,
        priority: DEADLINE_DAY_OF_PRIORITY,
      }));
    }
  }

  // ---- recommender inactivity ----
  const weekBucket = weekStartOf(today);
  for (const rec of state.recommenders) {
    for (const assignment of rec.assignments) {
      if (assignment.status !== 'invited' || assignment.invitedAt === null) continue;
      const app = applicationsById.get(assignment.applicationId);
      if (!app || !OPEN_APPLICATION_STATUSES.has(app.status)) continue;

      const daysSinceInvite = calendarDaysBetween(assignment.invitedAt, today);
      if (daysSinceInvite < RECOMMENDER_INACTIVITY_MIN_DAYS_SINCE_INVITE) continue;

      const daysRemaining = daysUntil(app.deadline, now, tz);
      if (daysRemaining >= RECOMMENDER_INACTIVITY_DEADLINE_WINDOW_DAYS) continue;

      const key = `recommender_inactivity:${rec.id}:${assignment.applicationId}:${weekBucket}`;
      emit(key, () => ({
        kind: 'recommender_inactivity',
        trigger_key: key,
        application_id: assignment.applicationId,
        application_item_id: null,
        recommender_id: rec.id,
        essay_id: null,
        due_date: app.deadline,
        days_remaining: daysRemaining,
        facts: {
          recommender: rec.name,
          school: app.schoolName,
          invited_on: assignment.invitedAt,
          days_since_invite: daysSinceInvite,
          days_remaining: daysRemaining,
        },
        always_send: false,
        priority: RECOMMENDER_INACTIVITY_PRIORITY,
      }));
    }
  }

  // ---- essay staleness ----
  // The Common App personal essay has no application of its own; it is due with the earliest
  // open application, so staleness is measured against that deadline.
  const earliestOpenApp = state.applications
    .filter((a) => OPEN_APPLICATION_STATUSES.has(a.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  for (const essay of state.essays) {
    if (essay.itemStatus === 'done') continue;
    const app = essay.applicationId ? applicationsById.get(essay.applicationId) : earliestOpenApp;
    if (!app || !OPEN_APPLICATION_STATUSES.has(app.status)) continue;

    const daysRemaining = daysUntil(app.deadline, now, tz);
    if (daysRemaining >= ESSAY_STALE_DEADLINE_WINDOW_DAYS) continue;

    const daysSinceEdit = essay.lastEditedAt === null ? null : calendarDaysBetween(localDate(essay.lastEditedAt, tz), today);
    const stale = daysSinceEdit === null || daysSinceEdit >= ESSAY_STALE_MIN_DAYS_SINCE_EDIT;
    if (!stale) continue;

    const key = `essay_staleness:${essay.id}:${weekBucket}`;
    emit(key, () => ({
      kind: 'essay_staleness',
      trigger_key: key,
      application_id: essay.applicationId,
      application_item_id: null,
      recommender_id: null,
      essay_id: essay.id,
      due_date: app.deadline,
      days_remaining: daysRemaining,
      facts: {
        essay: essay.title,
        school: app.schoolName,
        days_since_edit: daysSinceEdit,
        word_count: essay.wordCount,
        word_limit: essay.wordLimit,
        days_remaining: daysRemaining,
      },
      always_send: false,
      priority: ESSAY_STALENESS_PRIORITY,
    }));
  }

  // ---- score-send cutoff ----
  for (const item of state.items) {
    if (item.kind !== 'score_send' || !OPEN_ITEM_STATUSES.has(item.status) || item.dueDate === null) continue;
    const daysRemaining = daysUntil(item.dueDate, now, tz);
    if (daysRemaining > SCORE_SEND_CUTOFF_DAYS) continue;

    const key = `score_send_cutoff:${item.id}`;
    emit(key, () => ({
      kind: 'score_send_cutoff',
      trigger_key: key,
      application_id: item.applicationId,
      application_item_id: item.id,
      recommender_id: null,
      essay_id: null,
      due_date: item.dueDate,
      days_remaining: daysRemaining,
      facts: { item: item.title, school: item.schoolName, due_date: item.dueDate, days_remaining: daysRemaining },
      always_send: false,
      priority: SCORE_SEND_CUTOFF_PRIORITY,
    }));
  }

  // ---- morning plan ----
  if (time >= MORNING_PLAN_WINDOW_START && time < MORNING_PLAN_WINDOW_END) {
    const openItems = state.items.filter((i) => OPEN_ITEM_STATUSES.has(i.status));
    if (openItems.length > 0) {
      let nearest: TriggerApplication | null = null;
      let nearestDays: number | null = null;
      for (const app of state.applications) {
        if (!OPEN_APPLICATION_STATUSES.has(app.status)) continue;
        const d = daysUntil(app.deadline, now, tz);
        if (nearestDays === null || d < nearestDays) {
          nearestDays = d;
          nearest = app;
        }
      }

      const key = `morning_plan:${today}`;
      emit(key, () => ({
        kind: 'morning_plan',
        trigger_key: key,
        application_id: null,
        application_item_id: null,
        recommender_id: null,
        essay_id: null,
        due_date: null,
        days_remaining: null,
        facts: {
          open_items: openItems.length,
          nearest_deadline_school: nearest?.schoolName ?? null,
          nearest_deadline_days: nearestDays,
        },
        always_send: false,
        priority: MORNING_PLAN_PRIORITY,
      }));
    }
  }

  // ---- weekly plan ----
  if (localDayOfWeek(now, tz) === 0 && time >= WEEKLY_PLAN_WINDOW_START) {
    const key = `weekly_plan:${weekStartOf(today)}`;
    emit(key, () => ({
      kind: 'weekly_plan',
      trigger_key: key,
      application_id: null,
      application_item_id: null,
      recommender_id: null,
      essay_id: null,
      due_date: null,
      days_remaining: null,
      facts: {
        open_items: state.items.filter((i) => OPEN_ITEM_STATUSES.has(i.status)).length,
        open_applications: state.applications.filter((a) => OPEN_APPLICATION_STATUSES.has(a.status)).length,
      },
      always_send: false,
      priority: WEEKLY_PLAN_PRIORITY,
    }));
  }

  return events;
}
