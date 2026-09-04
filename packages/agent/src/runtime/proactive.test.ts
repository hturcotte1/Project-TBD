import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { scoped, type Db } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { getTestDb, truncateAll } from '@tbd/shared/testing';
import type { TriggerEvent } from '@tbd/shared/schemas';
import { factsMentioned, templateForTrigger } from '../integrations/shared-engines';
import { ScriptedFakeLLM } from '../llm/fake';
import { buildTestDeps } from '../testing/deps';
import { InMemoryMessagingProvider } from '../testing/messaging';
import { seedDemoStudent } from '../testing/seed';
import { phraseNudges, sendProactive } from './proactive';

function makeTrigger(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    kind: 'recommender_inactivity',
    trigger_key: 'recommender_inactivity:rec1',
    application_id: null,
    application_item_id: null,
    recommender_id: null,
    essay_id: null,
    due_date: null,
    days_remaining: null,
    facts: { recommender_name: 'Ms. Park', school_name: 'University of Michigan', days_since: 5 },
    always_send: false,
    priority: 50,
    ...overrides,
  };
}

describe('phraseNudges', () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll(db);
  });

  it('phrases each batch using only the given facts (RuleBasedFakeLLM)', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const trigger = makeTrigger();

    const [phrased] = await phraseNudges(deps, { studentId: seed.studentId, batches: [[trigger]] });

    expect(phrased!.source).toBe('llm');
    expect(phrased!.text).toContain('Ms. Park');
    expect(phrased!.text).toContain('University of Michigan');
    expect(factsMentioned(phrased!.text, trigger)).toBe(true);
  });

  it('falls back to the deterministic template when the model output fails fact validation', async () => {
    const seed = await seedDemoStudent(db);
    const scripted = new ScriptedFakeLLM();
    scripted.queueGenerate({
      model: 'scripted',
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
      content: [{ type: 'text', text: 'Hope your week is going great! Talk soon.' }],
    });
    const deps = buildTestDeps(db, { llm: scripted });
    const trigger = makeTrigger();

    const [phrased] = await phraseNudges(deps, { studentId: seed.studentId, batches: [[trigger]] });

    expect(phrased!.source).toBe('template');
    expect(phrased!.text).toBe(templateForTrigger(trigger));
    expect(factsMentioned(phrased!.text, trigger)).toBe(true);
  });
});

describe('sendProactive', () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll(db);
  });

  it('sends each phrased batch, records a nudge per trigger, and marks the message proactive', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const trigger = makeTrigger();
    const phrased = [{ batch: [trigger], text: "Ms. Park hasn't submitted for University of Michigan yet.", source: 'template' as const }];

    const result = await sendProactive(deps, { studentId: seed.studentId, phrased });

    expect(result.sent).toBe(1);
    const messaging = deps.messaging as InMemoryMessagingProvider;
    expect(messaging.sent.length).toBe(1);

    const sdb = scoped(db, seed.studentId);
    const nudgeRows = await sdb.select(S.nudges, eq(S.nudges.triggerKey, trigger.trigger_key));
    expect(nudgeRows.length).toBe(1);

    const messageRows = await sdb.select(S.messages, eq(S.messages.proactive, true));
    expect(messageRows.length).toBe(1);
    expect(messageRows[0]?.body).toContain('University of Michigan');
  });
});
