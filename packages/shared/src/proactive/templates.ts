import type { TriggerEvent } from '../schemas/proactive';

function factString(t: TriggerEvent, key: string): string {
  const v = t.facts[key];
  return v === null || v === undefined ? '' : String(v);
}

function factNumber(t: TriggerEvent, key: string): number | null {
  const v = t.facts[key];
  return typeof v === 'number' ? v : null;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function daysPhrase(days: number): string {
  if (days < 0) return `${plural(-days, 'day')} ago`;
  if (days === 0) return 'today';
  return `in ${plural(days, 'day')}`;
}

function unreachable(kind: never): never {
  throw new Error(`no template for trigger kind "${String(kind)}"`);
}

/**
 * Deterministic, concrete, at most two short sentences, built only from the trigger's own facts.
 * This is the fallback wording used whenever the LLM's phrasing is unavailable or fails
 * `factsMentioned` validation, so it must stand on its own as a message a student could receive.
 */
export function templateForTrigger(t: TriggerEvent): string {
  switch (t.kind) {
    case 'deadline_countdown': {
      const school = factString(t, 'school');
      const plan = factString(t, 'plan');
      const openItems = factNumber(t, 'open_items') ?? 0;
      const days = t.days_remaining ?? 0;
      return `${school} (${plan}) is due ${daysPhrase(days)}. You still have ${plural(openItems, 'item')} open there.`;
    }
    case 'deadline_day_of': {
      const school = factString(t, 'school');
      const openItems = factNumber(t, 'open_items') ?? 0;
      return `${school}'s deadline is today. ${openItems > 0 ? `Finish the ${plural(openItems, 'open item')} now.` : 'Everything there looks done — nice work.'}`;
    }
    case 'recommender_inactivity': {
      const recommender = factString(t, 'recommender');
      const school = factString(t, 'school');
      const daysSinceInvite = factNumber(t, 'days_since_invite') ?? 0;
      const days = t.days_remaining ?? 0;
      return `${recommender} still hasn't submitted your ${school} recommendation, ${plural(daysSinceInvite, 'day')} after you invited them. The deadline is ${daysPhrase(days)}.`;
    }
    case 'essay_staleness': {
      const essay = factString(t, 'essay');
      const school = factString(t, 'school');
      const daysSinceEdit = factNumber(t, 'days_since_edit');
      const wordCount = factNumber(t, 'word_count') ?? 0;
      const wordLimit = factNumber(t, 'word_limit');
      const editClause = daysSinceEdit === null ? "hasn't been started" : `hasn't been touched in ${plural(daysSinceEdit, 'day')}`;
      const words = wordLimit !== null ? `${wordCount}/${wordLimit} words` : `${plural(wordCount, 'word')}`;
      const days = t.days_remaining ?? 0;
      return `Your ${essay} essay for ${school} ${editClause} (${words}). It's due ${daysPhrase(days)}.`;
    }
    case 'score_send_cutoff': {
      const school = factString(t, 'school');
      const days = t.days_remaining ?? 0;
      return `Score sending for ${school} closes ${daysPhrase(days)}. Send your scores now to make the cutoff.`;
    }
    case 'morning_plan': {
      const openItems = factNumber(t, 'open_items') ?? 0;
      const nearestSchool = factString(t, 'nearest_deadline_school');
      const nearestDays = factNumber(t, 'nearest_deadline_days');
      const nearestClause = nearestSchool && nearestDays !== null ? ` ${nearestSchool} is closest, ${daysPhrase(nearestDays)}.` : '';
      return `Good morning — you have ${plural(openItems, 'open item')} today.${nearestClause}`;
    }
    case 'weekly_plan': {
      const openItems = factNumber(t, 'open_items') ?? 0;
      const openApplications = factNumber(t, 'open_applications') ?? 0;
      return `Weekly check-in: ${plural(openItems, 'open item')} across ${plural(openApplications, 'application')}. Let's plan the week.`;
    }
    case 'sync_change': {
      const summary = factString(t, 'summary');
      return summary.length > 0 ? `Your Common App changed: ${summary}.` : 'Your Common App changed since the last check.';
    }
    case 'custom': {
      const message = factString(t, 'message');
      return message.length > 0 ? message : 'You have an update worth a look.';
    }
    default:
      return unreachable(t.kind);
  }
}

/**
 * True when `text` mentions at least one salient fact from the trigger: the school name, the
 * recommender's name, or the day count. Used to validate LLM-phrased text before sending it —
 * if it invents facts instead of using the given ones, this returns false and the caller should
 * fall back to `templateForTrigger`.
 */
export function factsMentioned(text: string, t: TriggerEvent): boolean {
  const lower = text.toLowerCase();

  const school = factString(t, 'school') || factString(t, 'nearest_deadline_school');
  const recommender = factString(t, 'recommender');
  const dayCount = t.days_remaining ?? factNumber(t, 'days_remaining') ?? factNumber(t, 'nearest_deadline_days');

  const salient: Array<string | number | null> = [school || null, recommender || null, dayCount];
  return salient.some((v) => v !== null && String(v).length > 0 && lower.includes(String(v).toLowerCase()));
}
