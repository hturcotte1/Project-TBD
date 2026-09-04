/**
 * Test doubles for `LLMProvider`.
 *
 * `ScriptedFakeLLM` replays a queue of canned responses — use it when a test needs to control
 * exactly what the model says or extracts next.
 *
 * `RuleBasedFakeLLM` (DECISIONS.md #12) is the default for local dev and most tests: it
 * deterministically emulates the persona's decisions from the task, the latest student text,
 * any image/document content, tool results already in the transcript, and the available tools —
 * so the conversation runtime, the tool registry, the repos, messaging, and the audit log are all
 * exercised end to end without a network call.
 *
 * A note on document/image content: `LLMDocumentBlock`/`LLMImageBlock` carry base64 bytes with no
 * guarantee they're readable text. A real model reads the actual PDF/photo bytes; this fake
 * cannot. It best-effort-decodes the base64 payload as UTF-8 and pattern-matches on it, so test
 * fixtures that want the fake to "read" a transcript, resume, or photo should base64-encode plain
 * text (the `mediaType` can still say `application/pdf` / `image/jpeg` — the fake doesn't inspect
 * magic bytes, only content).
 */
import { randomUUID } from 'node:crypto';
import type {
  LLMAssistantContent,
  LLMExtractRequest,
  LLMExtractResponse,
  LLMGenerateRequest,
  LLMGenerateResponse,
  LLMMessage,
  LLMProvider,
} from '@tbd/shared/adapters';
import { EssayFeedback, PhotoExtraction, ResumeExtraction, StudentNarrative, TranscriptExtraction, WeeklyPlan } from '@tbd/shared/schemas';
import { findSchool, SCHOOL_BY_SLUG } from '../integrations/shared-engines';
import { ghostwritingRefusalText, isGhostwritingRequest } from '../runtime/essay';
import { readUntrustedBlock } from '../runtime/untrusted';
import { LLMExtractionError } from './errors';

// ---------------------------------------------------------------------------
// ScriptedFakeLLM
// ---------------------------------------------------------------------------

export type ScriptedEntry =
  | { kind: 'generate'; response: LLMGenerateResponse }
  | { kind: 'extract'; schemaName?: string; data: unknown };

/** Queue of canned responses, consumed in order (or by `schemaName` for extract calls). Throws when exhausted. */
export class ScriptedFakeLLM implements LLMProvider {
  readonly name = 'fake' as const;
  private readonly generateQueue: LLMGenerateResponse[] = [];
  private readonly extractByName = new Map<string, unknown[]>();
  private readonly extractQueue: unknown[] = [];

  constructor(entries: ScriptedEntry[] = []) {
    for (const e of entries) this.push(e);
  }

  push(entry: ScriptedEntry): this {
    if (entry.kind === 'generate') {
      this.generateQueue.push(entry.response);
    } else if (entry.schemaName) {
      const arr = this.extractByName.get(entry.schemaName) ?? [];
      arr.push(entry.data);
      this.extractByName.set(entry.schemaName, arr);
    } else {
      this.extractQueue.push(entry.data);
    }
    return this;
  }

  queueGenerate(response: LLMGenerateResponse): this {
    return this.push({ kind: 'generate', response });
  }

  queueExtract(data: unknown, schemaName?: string): this {
    return this.push({ kind: 'extract', schemaName, data });
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const next = this.generateQueue.shift();
    if (!next) throw new Error(`ScriptedFakeLLM: no scripted generate() response left for task "${req.task}"`);
    return next;
  }

  async extract<T>(req: LLMExtractRequest<T>): Promise<LLMExtractResponse<T>> {
    const byName = this.extractByName.get(req.schemaName);
    const raw = byName && byName.length > 0 ? byName.shift() : this.extractQueue.shift();
    if (raw === undefined) throw new Error(`ScriptedFakeLLM: no scripted extract() response left for schema "${req.schemaName}"`);
    const parsed = req.schema.safeParse(raw);
    if (!parsed.success) throw new LLMExtractionError(req.schemaName, parsed.error.message);
    return { model: 'scripted-fake', data: parsed.data, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

// ---------------------------------------------------------------------------
// RuleBasedFakeLLM
// ---------------------------------------------------------------------------

interface ToolResultEntry {
  input: unknown;
  content: string;
  isError: boolean;
}
type ToolResultsMap = Map<string, ToolResultEntry[]>;
type Decision = { toolCalls: Array<{ name: string; input: unknown }> } | { text: string };

function findLatestStudentTurn(messages: LLMMessage[]): { text: string; hasImage: boolean; hasDocument: boolean } {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'user') continue;
    const isGenuineTurn = m.content.some((b) => b.type !== 'tool_result');
    if (!isGenuineTurn) continue;
    const text = m.content
      .filter((b): b is Extract<(typeof m.content)[number], { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return { text, hasImage: m.content.some((b) => b.type === 'image'), hasDocument: m.content.some((b) => b.type === 'document') };
  }
  return { text: '', hasImage: false, hasDocument: false };
}

function collectToolResults(messages: LLMMessage[]): ToolResultsMap {
  const byId = new Map<string, string>();
  const out: ToolResultsMap = new Map();
  for (const m of messages) {
    if (m.role === 'assistant') {
      for (const b of m.content) if (b.type === 'tool_use') byId.set(b.id, b.name);
    } else {
      for (const b of m.content) {
        if (b.type !== 'tool_result') continue;
        const name = byId.get(b.toolUseId);
        if (!name) continue;
        const arr = out.get(name) ?? [];
        arr.push({ input: null, content: b.content, isError: b.isError ?? false });
        out.set(name, arr);
      }
    }
  }
  return out;
}

/** All text content across every message, plus a best-effort UTF-8 decode of any document/image bytes. */
function allText(messages: LLMMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === 'text') parts.push(b.text);
      else if (b.type === 'document' || b.type === 'image') {
        try {
          parts.push(Buffer.from(b.data, 'base64').toString('utf8'));
        } catch {
          /* not decodable as text; nothing to add */
        }
      }
    }
  }
  return parts.join('\n');
}

function findSchoolMention(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const entry of Object.values(SCHOOL_BY_SLUG)) {
    if ([entry.name, ...entry.aliases].some((c) => lower.includes(c.toLowerCase()))) return entry.name;
  }
  return undefined;
}

function extractDoneQuery(text: string): string {
  const m = /(?:done|finished) with (?:the |my )?(.+)/i.exec(text) ?? /(?:submitted|completed|sent) (?:the |my )?(.+)/i.exec(text);
  return (m?.[1] ?? text).replace(/[.!?]+$/, '').trim();
}

function extractAddSchool(text: string): string | undefined {
  const m = /\b(?:also applying to|add)\s+([a-z][a-z .&'-]*)$/i.exec(text.trim());
  return m?.[1]?.trim();
}

function nextFutureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

function findPhotoExtraction(text: string): PhotoExtraction | null {
  const block = readUntrustedBlock(text, 'photo');
  if (!block) return null;
  const start = block.indexOf('{');
  const end = block.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = PhotoExtraction.safeParse(JSON.parse(block.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function toolThenRespond(toolResults: ToolResultsMap, toolName: string, input: unknown, buildReply: (results: ToolResultEntry[]) => string): Decision {
  const prior = toolResults.get(toolName);
  if (!prior || prior.length === 0) return { toolCalls: [{ name: toolName, input }] };
  return { text: buildReply(prior) };
}

interface ConversationCtx {
  text: string;
  hasImage: boolean;
  system: string;
  toolResults: ToolResultsMap;
}

function decidePhoto(ctx: ConversationCtx): Decision {
  const prior = ctx.toolResults.get('updateRecommenderStatus');
  if (prior && prior.length > 0) return { text: prior[0]?.content ?? 'Got it, thanks for sending that.' };

  const extraction = findPhotoExtraction(ctx.text);
  const update = extraction?.recommender_update;
  if (update && (update.status === 'submitted' || update.status === 'invited' || update.status === 'declined')) {
    return {
      toolCalls: [
        {
          name: 'updateRecommenderStatus',
          input: { recommender: update.recommender_name, school: update.school_name ?? undefined, status: update.status, evidence: update.evidence },
        },
      ],
    };
  }
  return { text: 'Thanks for sending that — got it.' };
}

function decideStatus(ctx: ConversationCtx, text: string): Decision {
  const school = findSchoolMention(text);
  const needed = school ? ['listNextActions', 'getApplicationStatus'] : ['listNextActions'];
  const missing = needed.filter((n) => !ctx.toolResults.get(n)?.length);
  if (missing.length > 0) {
    return { toolCalls: missing.map((n) => ({ name: n, input: n === 'getApplicationStatus' && school ? { school } : {} })) };
  }
  const status = school ? (ctx.toolResults.get('getApplicationStatus')?.[0]?.content ?? '') : '';
  const nextActions = ctx.toolResults.get('listNextActions')?.[0]?.content ?? '';
  const reply = [status, nextActions].filter(Boolean).join(' ');
  return { text: reply.length > 0 ? reply : "You're all caught up — nothing open right now." };
}

function decideStressed(ctx: ConversationCtx): Decision {
  const prior = ctx.toolResults.get('listNextActions');
  if (!prior || prior.length === 0) return { toolCalls: [{ name: 'listNextActions', input: { limit: 3 } }] };
  const firstAction = (prior[0]?.content ?? '').split(';')[0]?.trim() || 'taking a five-minute break';
  return { text: `Totally hear you — this is a lot. Just do one small thing: ${firstAction}.` };
}

const GENERIC_PHRASES = ['ever since i was young', 'passion', "in today's society", 'little did i know', 'i learned that', 'shaped who i am today'];

function analyzeDraftForFeedback(draft: string): string {
  const lower = draft.toLowerCase();
  const found = GENERIC_PHRASES.find((p) => lower.includes(p));
  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  if (found) {
    return `A couple spots read generic — "${found}" is a phrase a lot of essays use; swap it for something only you could say. Otherwise it's ${words} words. Want to talk through the opening line?`;
  }
  return `This is ${words} words and it reads like your voice. The strongest moment is where you get specific — lean into more of that. What part feels weakest to you?`;
}

function decideEssayFeedback(ctx: ConversationCtx, text: string): Decision {
  const prior = ctx.toolResults.get('getEssay');
  if (!prior || prior.length === 0) return { toolCalls: [{ name: 'getEssay', input: { query: text } }] };
  const content = prior[0]?.content ?? '';
  const draftMatch = /DRAFT:\n([\s\S]*)$/.exec(content);
  if (!draftMatch?.[1]) return { text: "I don't have a saved draft for that one yet — send it over or add it on the dashboard and I'll take a look." };
  return { text: analyzeDraftForFeedback(draftMatch[1]) };
}

function decideConversation(ctx: ConversationCtx): Decision {
  const text = ctx.text.trim();
  const lower = text.toLowerCase();

  if (isGhostwritingRequest(lower)) return { text: ghostwritingRefusalText() };
  if (ctx.hasImage) return decidePhoto(ctx);

  if (/\b(leave me alone|stop texting me)\b[\s\S]*\btonight\b/i.test(lower)) {
    return toolThenRespond(ctx.toolResults, 'snoozeNotifications', { until: nextFutureIso(8) }, () => "You got it — I'll leave you alone tonight.");
  }

  if (/\b(stressed|overwhelmed)\b/i.test(lower)) return decideStressed(ctx);

  if (/^\d{4,8}$/.test(text) && /#{1,6}\s*awaiting verification\n(?!none\.)/i.test(ctx.system)) {
    return toolThenRespond(ctx.toolResults, 'answerVerificationCode', { code: text }, (r) => r[0]?.content ?? 'Got it, sending that through now.');
  }

  if (/^(yes|yep|yeah|sure|do it|go ahead|ok|okay)[.!]?$/i.test(lower) && /#{1,6}\s*pending approvals\n(?!none\.)/i.test(ctx.system)) {
    return toolThenRespond(ctx.toolResults, 'approveProposal', {}, (r) => r[0]?.content ?? "Done — I'm on it.");
  }

  const looksLikeFeedbackAsk = /\b(feedback|thoughts|review|how'?s|how is|what do you think)\b/i.test(lower) && /\b(essay|draft|supp|writing|personal statement|why [a-z]+)\b/i.test(lower);
  if (looksLikeFeedbackAsk) return decideEssayFeedback(ctx, text);

  if (/\bactivities\b[\s\S]*\bcommon ?app\b/i.test(lower) || /\bfill (in )?my activities\b/i.test(lower)) {
    return toolThenRespond(ctx.toolResults, 'proposeFillFields', { section: 'activities' }, (r) => r[0]?.content ?? 'Ready when you are.');
  }

  const addSchool = extractAddSchool(text);
  if (addSchool) {
    return toolThenRespond(ctx.toolResults, 'addApplication', { school: addSchool }, (r) => r[0]?.content ?? 'Added.');
  }

  if (/\b(sync|check common ?app)\b/i.test(lower)) {
    return toolThenRespond(ctx.toolResults, 'requestSync', {}, (r) => r[0]?.content ?? 'Syncing now.');
  }

  if (/\bsend me the dashboard\b/i.test(lower)) {
    return toolThenRespond(ctx.toolResults, 'sendDashboardLink', {}, (r) => r[0]?.content ?? 'Here you go.');
  }

  if (/\b(what'?s next|whats next|status|how am i doing|how'?m i doing)\b/i.test(lower)) {
    return decideStatus(ctx, text);
  }

  if (/\b(done|finished) with\b/i.test(lower) || /\b(submitted|completed|sent) (the|my)\b/i.test(lower) || /^i'?m (done|finished)\b/i.test(lower)) {
    return toolThenRespond(ctx.toolResults, 'markItemDone', { query: extractDoneQuery(text) }, (r) => r[0]?.content ?? 'Marked that done.');
  }

  return { text: 'Got it. Want your next actions, or a status update on a specific school?' };
}

function toGenerateResponse(decision: Decision): LLMGenerateResponse {
  if ('toolCalls' in decision) {
    const content: LLMAssistantContent[] = decision.toolCalls.map((c) => ({ type: 'tool_use', id: `fake_${randomUUID()}`, name: c.name, input: c.input }));
    return { model: 'rule-based-fake', content, stopReason: 'tool_use', usage: { inputTokens: 0, outputTokens: 0 } };
  }
  return { model: 'rule-based-fake', content: [{ type: 'text', text: decision.text }], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 } };
}

function buildTranscriptExtraction(messages: LLMMessage[]): TranscriptExtraction {
  const text = allText(messages);
  const gpaMatch = /unweighted[^0-9]{0,15}(\d\.\d{1,2})|gpa[^0-9]{0,10}(\d\.\d{1,2})/i.exec(text);
  const weightedMatch = /weighted[^0-9]{0,15}(\d\.\d{1,2})/i.exec(text);
  const satMatch = /\bsat\b[^0-9]{0,10}(\d{3,4})/i.exec(text);
  const actMatch = /\bact\b[^0-9]{0,10}(\d{1,2})\b/i.exec(text);
  const courseLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\b(AP|Honors|IB)\b/i.test(l) && l.length < 80);
  return {
    academics: {
      gpa_unweighted: gpaMatch ? Number(gpaMatch[1] ?? gpaMatch[2]) : null,
      gpa_weighted: weightedMatch ? Number(weightedMatch[1]) : null,
      gpa_scale: null,
      class_rank: null,
      class_size: null,
      rigor_summary: '',
      senior_courses: [],
    },
    test_scores: {
      sat: satMatch ? [{ total: Number(satMatch[1]), ebrw: null, math: null, date: null }] : [],
      act: actMatch ? [{ composite: Number(actMatch[1]), english: null, math: null, reading: null, science: null, date: null }] : [],
      ap: [],
      ib: [],
      test_optional_stance: 'undecided',
    },
    courses: courseLines.slice(0, 15).map((name) => ({
      name: name.slice(0, 120),
      grade: null,
      year: null,
      level: /AP/i.test(name) ? 'AP' : /honors/i.test(name) ? 'honors' : /IB/i.test(name) ? 'IB' : 'regular',
      credits: null,
    })),
    school_name: null,
    confidence: text.trim().length > 0 ? 0.8 : 0.2,
    notes: 'Derived by RuleBasedFakeLLM via regex over decoded text; not a real transcript parse.',
  };
}

function buildResumeExtraction(messages: LLMMessage[]): ResumeExtraction {
  const text = allText(messages);
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const activities: ResumeExtraction['activities'] = [];
  for (const line of lines) {
    if (activities.length >= 10) break;
    const m = /^([^,\-–]{2,60})[,\-–]\s*(.{2,90})$/.exec(line);
    if (!m) continue;
    activities.push({
      activity_type: 'other',
      position: (m[1] ?? line).trim().slice(0, 50),
      organization: (m[2] ?? '').trim().slice(0, 100),
      description: line.slice(0, 150),
      grade_levels: ['11', '12'],
      timing: ['school_year'],
      hours_per_week: 3,
      weeks_per_year: 30,
      continue_in_college: false,
    });
  }
  return { activities, dropped: [], confidence: activities.length > 0 ? 0.7 : 0.2, notes: 'Derived by RuleBasedFakeLLM from raw text lines.' };
}

function buildPhotoExtractionFromText(messages: LLMMessage[]): PhotoExtraction {
  const text = allText(messages);
  const lower = text.toLowerCase();
  const mentionsUpdate = /submitted|recommendation|letter/.test(lower);
  const nameMatch = /\b(mr\.?|ms\.?|mrs\.?|dr\.?)\s+([a-z]+)/i.exec(text);
  const recommenderName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}`.trim() : 'your recommender';
  const status: 'invited' | 'submitted' | 'declined' | 'unknown' = /declin/.test(lower)
    ? 'declined'
    : /submitted|has submitted|just submitted/.test(lower)
      ? 'submitted'
      : /invit/.test(lower)
        ? 'invited'
        : 'unknown';
  return {
    kind: 'recommender_email',
    recommender_update: mentionsUpdate ? { recommender_name: recommenderName, school_name: null, status, evidence: (text.slice(0, 300) || 'photo evidence').trim() } : null,
    deadline_notice: null,
    summary: (text.slice(0, 300) || 'Photo received.').trim(),
    confidence: mentionsUpdate ? 0.75 : 0.4,
  };
}

function buildStudentNarrative(messages: LLMMessage[]): StudentNarrative {
  const text = allText(messages);
  const re = /\[(\w+)\][^\n]*\nA:\s*([\s\S]*?)(?=\n\[\w+\]|$)/g;
  const answers = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = m[1];
    const answer = (m[2] ?? '').trim();
    if (key && answer) answers.set(key, answer);
  }
  const hardThing = answers.get('hard_thing');
  const stories: StudentNarrative['stories'] = hardThing
    ? [{ title: 'A hard thing', summary: hardThing.slice(0, 800), details: '', what_it_changed: hardThing, themes: [], fits_prompts: [] }]
    : [];
  const themeSource = [answers.get('cares_about'), answers.get('wants_to_do')].filter(Boolean).join(' ');
  const themes: StudentNarrative['themes'] = themeSource
    ? [{ title: (answers.get('cares_about') ?? '').split(/[.,]/)[0]?.slice(0, 120) || 'What they care about', description: themeSource.slice(0, 600), evidence: [] }]
    : [];
  return {
    themes,
    stories,
    values: [],
    voice_notes: { sentence_style: '', humor: '', vocabulary: '', samples: [] },
    cares_about: answers.get('cares_about') ?? '',
    wants_to_do: answers.get('wants_to_do') ?? '',
    free_saturday: answers.get('free_saturday') ?? '',
    proud_of_not_on_resume: answers.get('proud_of_not_on_resume') ?? '',
    home_vs_school: answers.get('home_vs_school') ?? '',
    family_context: answers.get('family_context') ?? '',
    anxieties: answers.get('anxieties') ?? '',
    summary: themeSource.slice(0, 500),
  };
}

function buildEssayFeedback(messages: LLMMessage[]): EssayFeedback {
  const text = allText(messages);
  const draftMatch = /Draft \(the student's own words\):\n([\s\S]*)$/.exec(text);
  const draft = (draftMatch?.[1] ?? text).trim();
  const limitMatch = /Word limit:\s*(\d+|none)/i.exec(text);
  const limit = limitMatch && limitMatch[1] !== 'none' ? Number(limitMatch[1]) : null;
  const words = draft.split(/\s+/).filter(Boolean).length;
  const lower = draft.toLowerCase();
  const genericFound = GENERIC_PHRASES.filter((p) => lower.includes(p));
  const voiceNoteMatch = /Voice notes: sentence style — (.*?);/i.exec(text);
  const voiceStyle = voiceNoteMatch?.[1]?.trim() ?? '';
  return {
    answers_prompt: {
      verdict: words > 20 ? 'yes' : 'partially',
      note: words > 20 ? 'The draft engages with the prompt.' : 'This reads more like a start than a full answer to the prompt yet.',
    },
    clarity: [],
    structure: [],
    generic_phrases: genericFound.map((p) => ({ quote: p, note: `"${p}" shows up in a lot of essays — say what's true only for you instead.` })),
    voice_match: {
      matches: voiceStyle && !voiceStyle.toLowerCase().includes('unknown') ? 'mostly' : 'no',
      note: voiceStyle ? `Compared with the sentence style you described ("${voiceStyle}"), this draft is close but not fully there yet.` : 'No voice notes on file yet to compare against.',
    },
    where_a_real_detail_would_be_stronger:
      genericFound.length > 0 ? [{ quote: genericFound[0] ?? null, note: 'Replace this with one concrete, specific moment only you experienced.' }] : [],
    word_count: {
      current: words,
      limit,
      note: limit && words > limit ? `${words - limit} words over the limit.` : limit && words < limit * 0.6 ? 'Well under the limit — there is room to add detail.' : 'Within a reasonable range.',
    },
    top_three_next_steps: [
      genericFound.length > 0 ? `Cut or replace the generic phrase "${genericFound[0]}".` : 'Add one more concrete, sensory detail.',
      limit && words > limit ? 'Trim it down to fit the word limit.' : "Make sure the last two sentences land on what changed in you.",
      "Read it out loud once and mark any sentence that doesn't sound like you talking.",
    ],
    questions_to_ask_yourself: ['What is the one image from this that a reader would remember tomorrow?'],
  };
}

function buildWeeklyPlan(messages: LLMMessage[]): WeeklyPlan {
  const text = allText(messages);
  const weekStartMatch = /Week start:\s*(\d{4}-\d{2}-\d{2})/i.exec(text);
  const weekStart = weekStartMatch?.[1] ?? new Date().toISOString().slice(0, 10);
  const lineRe = /^-\s*(.+?)\s*\|\s*(.+?)\s*\|\s*due:(\S+)\s*\|\s*items:(\S*)\s*$/gm;
  const priorities: WeeklyPlan['priorities'] = [];
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) && priorities.length < 8) {
    const title = m[1] ?? '';
    const why = m[2] ?? '';
    const due = m[3] ?? 'none';
    const items = m[4] ?? '';
    priorities.push({
      title: title.slice(0, 200),
      why: why.slice(0, 400),
      item_ids: items ? items.split(',').filter((s) => /^[0-9a-f-]{36}$/i.test(s)) : [],
      due: due !== 'none' ? due : null,
    });
  }
  if (priorities.length === 0) {
    priorities.push({ title: 'Catch up on your open items', why: 'Nothing structured was provided for this week.', item_ids: [], due: null });
  }
  return { week_start: weekStart, priorities, text_summary: `This week: ${priorities.slice(0, 3).map((p) => p.title).join('; ')}.`.slice(0, 1200) };
}

/** Deterministic emulation of the persona for local dev and tests. See file header for the strategy. */
export class RuleBasedFakeLLM implements LLMProvider {
  readonly name = 'fake' as const;

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    if (req.task === 'interview') return this.generateInterview(req);
    if (req.task === 'prioritization') return this.generatePrioritization(req);
    if (req.task === 'reminder_draft') return this.generateReminderDraft(req);
    return this.generateConversation(req);
  }

  private generateConversation(req: LLMGenerateRequest): LLMGenerateResponse {
    const turn = findLatestStudentTurn(req.messages);
    const toolResults = collectToolResults(req.messages);
    const decision = decideConversation({ text: turn.text, hasImage: turn.hasImage, system: req.system, toolResults });
    return toGenerateResponse(decision);
  }

  private generateInterview(req: LLMGenerateRequest): LLMGenerateResponse {
    const turn = findLatestStudentTurn(req.messages);
    const allCovered = /every topic has at least something captured/i.test(req.system);
    if (allCovered) {
      return toGenerateResponse({ text: "I think I've got a real sense of you now. Want to wrap up here, or is there anything else on your mind?" });
    }
    const nextMatch = /Next topic to ask about:\s*(.+)/i.exec(req.system);
    const nextPrompt = nextMatch?.[1]?.trim() || 'Tell me more about yourself.';
    const ack = turn.text.trim().length > 0 ? 'That means something, thanks for telling me that. ' : '';
    return toGenerateResponse({ text: `${ack}${nextPrompt}` });
  }

  private generatePrioritization(req: LLMGenerateRequest): LLMGenerateResponse {
    const text = allText(req.messages);
    const factsMatch = /FACTS_JSON:\s*(\{[\s\S]*?\})\s*(?:\n|$)/.exec(text);
    let phrase = '';
    if (factsMatch?.[1]) {
      try {
        const facts = JSON.parse(factsMatch[1]) as Record<string, unknown>;
        phrase = Object.values(facts)
          .filter((v) => v !== null && v !== '' && v !== undefined)
          .map(String)
          .join(' — ');
      } catch {
        phrase = '';
      }
    }
    if (!phrase) phrase = text.slice(0, 300);
    return toGenerateResponse({ text: phrase.slice(0, 320) });
  }

  private generateReminderDraft(req: LLMGenerateRequest): LLMGenerateResponse {
    const text = allText(req.messages);
    const name = /Recommender:\s*(.+)/i.exec(text)?.[1]?.trim() || 'there';
    const school = /School:\s*(.+)/i.exec(text)?.[1]?.trim();
    const note = `Hi ${name}, I hope your week is going well! I wanted to check in gently about my recommendation letter${
      school ? ` for ${school}` : ''
    } whenever you get a chance. Thank you so much for taking the time to write it for me — I really appreciate it.`;
    return toGenerateResponse({ text: note });
  }

  async extract<T>(req: LLMExtractRequest<T>): Promise<LLMExtractResponse<T>> {
    const data = this.buildExtraction(req);
    const parsed = req.schema.safeParse(data);
    if (!parsed.success) {
      throw new LLMExtractionError(req.schemaName, parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '));
    }
    return { model: 'rule-based-fake', data: parsed.data, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  private buildExtraction(req: LLMExtractRequest<unknown>): unknown {
    switch (req.schemaName) {
      case 'TranscriptExtraction':
        return buildTranscriptExtraction(req.messages);
      case 'ResumeExtraction':
        return buildResumeExtraction(req.messages);
      case 'PhotoExtraction':
        return buildPhotoExtractionFromText(req.messages);
      case 'StudentNarrative':
        return buildStudentNarrative(req.messages);
      case 'EssayFeedback':
        return buildEssayFeedback(req.messages);
      case 'WeeklyPlan':
        return buildWeeklyPlan(req.messages);
      default:
        throw new LLMExtractionError(req.schemaName, `RuleBasedFakeLLM has no rule for schema "${req.schemaName}"`);
    }
  }
}
