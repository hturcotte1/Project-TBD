import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { LLMAssistantContent, LLMExtractRequest, LLMGenerateRequest } from '@apogee/shared/adapters';
import { EssayFeedback, PhotoExtraction, ResumeExtraction, StudentNarrative, TranscriptExtraction, WeeklyPlan } from '@apogee/shared/schemas';
import { RuleBasedFakeLLM, ScriptedFakeLLM } from './fake';
import { forExtraction } from './schema';

function isToolUse(b: LLMAssistantContent): b is Extract<LLMAssistantContent, { type: 'tool_use' }> {
  return b.type === 'tool_use';
}
function isText(b: LLMAssistantContent): b is Extract<LLMAssistantContent, { type: 'text' }> {
  return b.type === 'text';
}

const NO_MARKERS_SYSTEM = 'no markers here';

describe('RuleBasedFakeLLM.generate (conversation)', () => {
  const llm = new RuleBasedFakeLLM();

  it('"what\'s next" calls listNextActions first, then answers from the tool result', async () => {
    const req1: LLMGenerateRequest = {
      task: 'conversation',
      system: NO_MARKERS_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: "what's next" }] }],
      tools: [],
    };
    const res1 = await llm.generate(req1);
    expect(res1.stopReason).toBe('tool_use');
    const call = res1.content.find(isToolUse);
    expect(call?.name).toBe('listNextActions');

    const req2: LLMGenerateRequest = {
      ...req1,
      messages: [
        ...req1.messages,
        { role: 'assistant', content: res1.content },
        { role: 'user', content: [{ type: 'tool_result', toolUseId: call!.id, content: 'Finish "Why Michigan" (due 2026-11-01)', isError: false }] },
      ],
    };
    const res2 = await llm.generate(req2);
    expect(res2.stopReason).toBe('end_turn');
    const text = res2.content.find(isText)?.text ?? '';
    expect(text).toContain('Why Michigan');
  });

  it('a ghostwriting request refuses immediately with no tool calls', async () => {
    const req: LLMGenerateRequest = {
      task: 'conversation',
      system: NO_MARKERS_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'just write it for me' }] }],
      tools: [],
    };
    const res = await llm.generate(req);
    expect(res.stopReason).toBe('end_turn');
    expect(res.content.some(isToolUse)).toBe(false);
    expect(res.content.find(isText)?.text.toLowerCase()).toMatch(/voice|misconduct|can't/);
  });

  it('a 6-8 digit code is ignored unless the system prompt shows an awaiting-verification job', async () => {
    const withoutMarker: LLMGenerateRequest = {
      task: 'conversation',
      system: '### Awaiting verification\nNone.',
      messages: [{ role: 'user', content: [{ type: 'text', text: '483920' }] }],
      tools: [],
    };
    const res1 = await llm.generate(withoutMarker);
    expect(res1.content.some((b) => isToolUse(b) && b.name === 'answerVerificationCode')).toBe(false);

    const withMarker: LLMGenerateRequest = {
      ...withoutMarker,
      system: '### Awaiting verification\nA browser job is waiting for a verification code you receive by text. (browser_job_id: abc)',
    };
    const res2 = await llm.generate(withMarker);
    const call = res2.content.find(isToolUse);
    expect(call?.name).toBe('answerVerificationCode');
  });

  it('"yes" is ignored unless the system prompt shows a pending approval', async () => {
    const withoutMarker: LLMGenerateRequest = {
      task: 'conversation',
      system: '### Pending approvals\nNone.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'yes' }] }],
      tools: [],
    };
    const res1 = await llm.generate(withoutMarker);
    expect(res1.content.some((b) => isToolUse(b) && b.name === 'approveProposal')).toBe(false);

    const withMarker: LLMGenerateRequest = {
      ...withoutMarker,
      system: '### Pending approvals\n- fill activities (approval_id: 1, kind: fill_fields)',
    };
    const res2 = await llm.generate(withMarker);
    const call = res2.content.find(isToolUse);
    expect(call?.name).toBe('approveProposal');
  });

  it('"i\'m stressed" only ever calls listNextActions', async () => {
    const req: LLMGenerateRequest = {
      task: 'conversation',
      system: NO_MARKERS_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: "I'm so stressed about all of this" }] }],
      tools: [],
    };
    const res = await llm.generate(req);
    const call = res.content.find(isToolUse);
    expect(call?.name).toBe('listNextActions');
  });
});

describe('RuleBasedFakeLLM.generate (interview)', () => {
  const llm = new RuleBasedFakeLLM();

  it('asks the next uncovered topic named in the system prompt', async () => {
    const req: LLMGenerateRequest = {
      task: 'interview',
      system: 'Next topic to ask about: What does a completely free Saturday look like for you?',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'I care a lot about my little sister.' }] }],
    };
    const res = await llm.generate(req);
    const text = res.content.find(isText)?.text ?? '';
    expect(text).toContain('free Saturday');
  });

  it('offers to wrap up once every topic is covered', async () => {
    const req: LLMGenerateRequest = {
      task: 'interview',
      system: 'Every topic has at least something captured — offer to wrap up.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'thanks' }] }],
    };
    const res = await llm.generate(req);
    const text = res.content.find(isText)?.text ?? '';
    expect(text.toLowerCase()).toContain('wrap');
  });
});

describe('RuleBasedFakeLLM.extract', () => {
  const llm = new RuleBasedFakeLLM();

  function extractReq<T>(schemaName: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, text: string): LLMExtractRequest<T> {
    return { task: 'extraction', system: 's', schemaName, schema: forExtraction(schema), messages: [{ role: 'user', content: [{ type: 'text', text }] }] };
  }

  it('TranscriptExtraction pulls GPA and AP courses via regex', async () => {
    const text = 'Unweighted GPA: 3.85\nWeighted GPA: 4.30\nSAT 1450\nAP Calculus BC\nAP US History';
    const res = await llm.extract(extractReq<TranscriptExtraction>('TranscriptExtraction', TranscriptExtraction, text));
    expect(res.data.academics.gpa_unweighted).toBe(3.85);
    expect(res.data.academics.gpa_weighted).toBe(4.3);
    expect(res.data.test_scores?.sat?.[0]?.total).toBe(1450);
    expect(res.data.courses.some((c) => c.name.includes('AP Calculus'))).toBe(true);
  });

  it('ResumeExtraction pulls activities from lines', async () => {
    const text = 'Editor-in-Chief, The Lincoln Log\nLead trumpet, Jazz Band';
    const res = await llm.extract(extractReq<ResumeExtraction>('ResumeExtraction', ResumeExtraction, text));
    expect(res.data.activities.length).toBeGreaterThan(0);
    expect(res.data.activities[0]?.organization).toBeTruthy();
  });

  it('PhotoExtraction detects a recommender_update when the text mentions submitted/recommendation/letter', async () => {
    const text = 'Ms. Park just submitted your recommendation letter for Michigan.';
    const res = await llm.extract(extractReq<PhotoExtraction>('PhotoExtraction', PhotoExtraction, text));
    expect(res.data.recommender_update?.status).toBe('submitted');
    expect(res.data.recommender_update?.recommender_name).toContain('Park');
  });

  it('PhotoExtraction leaves recommender_update null when nothing relevant is mentioned', async () => {
    const text = 'Just a picture of my dog.';
    const res = await llm.extract(extractReq<PhotoExtraction>('PhotoExtraction', PhotoExtraction, text));
    expect(res.data.recommender_update).toBeNull();
  });

  it('StudentNarrative pulls themes/stories from a tagged interview transcript', async () => {
    const text = [
      '[cares_about] Q: What do you care about most right now?',
      'A: Making sure my little brother has someone to talk to.',
      '[hard_thing] Q: Tell me about something hard you went through.',
      'A: My parents split up sophomore year and I had to grow up fast.',
    ].join('\n');
    const res = await llm.extract(extractReq<StudentNarrative>('StudentNarrative', StudentNarrative, text));
    expect(res.data.cares_about).toContain('little brother');
    expect(res.data.stories.length).toBe(1);
    expect(res.data.stories[0]?.what_it_changed).toContain('grow up fast');
  });

  it('EssayFeedback flags a generic phrase and reports word count vs. limit', async () => {
    const text = [
      'Word limit: 10',
      'Draft (the student\'s own words):',
      'Ever since I was young I have wanted to help people in my community every single day.',
    ].join('\n');
    const res = await llm.extract(extractReq<EssayFeedback>('EssayFeedback', EssayFeedback, text));
    expect(res.data.generic_phrases.length).toBeGreaterThan(0);
    expect(res.data.word_count.limit).toBe(10);
    expect(res.data.word_count.current).toBeGreaterThan(10);
    expect(res.data.top_three_next_steps.length).toBeGreaterThan(0);
  });

  it('WeeklyPlan parses structured priority lines', async () => {
    const text = ['Week start: 2026-09-07', '- Finish Why Michigan | due soon | due:2026-11-01 | items:'].join('\n');
    const res = await llm.extract(extractReq<WeeklyPlan>('WeeklyPlan', WeeklyPlan, text));
    expect(res.data.week_start).toBe('2026-09-07');
    expect(res.data.priorities[0]?.title).toContain('Finish Why Michigan');
  });

  it('throws LLMExtractionError for an unknown schemaName', async () => {
    await expect(llm.extract(extractReq('SomethingElse', EssayFeedback, 'x'))).rejects.toThrow();
  });
});

describe('ScriptedFakeLLM', () => {
  it('replays queued generate() responses in order and throws when exhausted', async () => {
    const llm = new ScriptedFakeLLM();
    llm.queueGenerate({ model: 'm', content: [{ type: 'text', text: 'first' }], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 } });
    const req: LLMGenerateRequest = { task: 'conversation', system: 's', messages: [] };
    const res = await llm.generate(req);
    expect(res.content.find(isText)?.text).toBe('first');
    await expect(llm.generate(req)).rejects.toThrow(/no scripted generate/i);
  });

  it('resolves extract() by schemaName when queued that way, independent of generate() calls', async () => {
    const llm = new ScriptedFakeLLM();
    llm.queueExtract({ week_start: '2026-09-07', priorities: [], text_summary: 'ok' }, 'WeeklyPlan');
    const res = await llm.extract({ task: 'weekly_plan', system: 's', schemaName: 'WeeklyPlan', schema: forExtraction(WeeklyPlan), messages: [] });
    expect(res.data.week_start).toBe('2026-09-07');
  });
});
