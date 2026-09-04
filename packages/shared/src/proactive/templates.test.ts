import { describe, expect, it } from 'vitest';
import type { TriggerEvent } from '../schemas/proactive';
import { factsMentioned, templateForTrigger } from './templates';

function trigger(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    kind: 'deadline_countdown',
    trigger_key: 'key',
    application_id: 'app-michigan',
    application_item_id: null,
    recommender_id: null,
    essay_id: null,
    due_date: '2026-11-01',
    days_remaining: 7,
    facts: { school: 'Michigan', plan: 'EA', deadline: '2026-11-01', days_remaining: 7, open_items: 3 },
    always_send: false,
    priority: 55,
    ...overrides,
  };
}

describe('templateForTrigger', () => {
  it('is deterministic', () => {
    const t = trigger();
    expect(templateForTrigger(t)).toBe(templateForTrigger(t));
  });

  it('produces at most two sentences', () => {
    const t = trigger();
    const sentences = templateForTrigger(t).split('.').filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });

  it('mentions the school and the day count for a deadline countdown', () => {
    const text = templateForTrigger(trigger());
    expect(text).toContain('Michigan');
    expect(text).toContain('7');
  });

  it('mentions the school for a day-of alert', () => {
    const t = trigger({ kind: 'deadline_day_of', days_remaining: 0, facts: { school: 'Michigan', plan: 'EA', deadline: '2026-11-01', open_items: 2 } });
    const text = templateForTrigger(t);
    expect(text).toContain('Michigan');
    expect(text.toLowerCase()).toContain('today');
  });

  it('mentions the recommender name and days since invite', () => {
    const t = trigger({
      kind: 'recommender_inactivity',
      recommender_id: 'rec-park',
      days_remaining: 5,
      facts: { recommender: 'Ms. Park', school: 'Michigan', invited_on: '2026-08-20', days_since_invite: 15, days_remaining: 5 },
    });
    const text = templateForTrigger(t);
    expect(text).toContain('Ms. Park');
    expect(text).toContain('Michigan');
  });

  it('mentions the essay title and word count', () => {
    const t = trigger({
      kind: 'essay_staleness',
      essay_id: 'essay-1',
      days_remaining: 10,
      facts: { essay: 'Why Michigan', school: 'Michigan', days_since_edit: 8, word_count: 143, word_limit: 550, days_remaining: 10 },
    });
    const text = templateForTrigger(t);
    expect(text).toContain('Why Michigan');
    expect(text).toContain('143');
    expect(text).toContain('550');
  });

  it('handles a never-edited essay without crashing', () => {
    const t = trigger({
      kind: 'essay_staleness',
      facts: { essay: 'Common App Essay', school: 'Michigan', days_since_edit: null, word_count: 0, word_limit: null, days_remaining: 20 },
    });
    expect(() => templateForTrigger(t)).not.toThrow();
    expect(templateForTrigger(t)).toContain('Common App Essay');
  });

  it('renders every nudge kind without crashing', () => {
    const kinds: TriggerEvent['kind'][] = [
      'deadline_countdown',
      'deadline_day_of',
      'recommender_inactivity',
      'essay_staleness',
      'score_send_cutoff',
      'morning_plan',
      'weekly_plan',
      'sync_change',
      'custom',
    ];
    for (const kind of kinds) {
      const text = templateForTrigger(trigger({ kind }));
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('factsMentioned', () => {
  it('is true when the text mentions the school', () => {
    const t = trigger();
    expect(factsMentioned(`Don't forget Michigan is coming up soon!`, t)).toBe(true);
  });

  it('is true when the text mentions the day count', () => {
    const t = trigger({ facts: {} });
    expect(factsMentioned('Only 7 days left to get this done.', t)).toBe(true);
  });

  it('is true when the text mentions the recommender name', () => {
    const t = trigger({
      kind: 'recommender_inactivity',
      facts: { recommender: 'Ms. Park', school: '', days_since_invite: 15 },
      days_remaining: null,
    });
    expect(factsMentioned('Ms. Park has not submitted your recommendation yet.', t)).toBe(true);
  });

  it('is false when the text mentions none of the salient facts', () => {
    const t = trigger();
    expect(factsMentioned('You have some things to do soon, check your dashboard.', t)).toBe(false);
  });

  it('is true for the template output itself', () => {
    const t = trigger();
    expect(factsMentioned(templateForTrigger(t), t)).toBe(true);
  });
});
