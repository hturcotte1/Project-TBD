import { eq } from 'drizzle-orm';
import { appendAudit, messagesRepo, scoped } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import type {
  LLMAssistantContent,
  LLMMessage,
  LLMStopReason,
  LLMToolDefinition,
  LLMToolResultBlock,
  LLMToolUseBlock,
  LLMUserContent,
} from '@apogee/shared/adapters';
import { PhotoExtraction, type ToolCallRecord } from '@apogee/shared/schemas';
import type { ConversationKind } from '@apogee/shared/domain';
import { loadStudentContext } from '../context';
import { forExtraction } from '../llm/schema';
import { buildSystemPrompt } from '../persona';
import { TOOLS } from '../tools/registry';
import { executeToolCalls, type ExecutedToolCall } from '../tools/executor';
import type { ToolContext } from '../tools/types';
import type { AgentDeps, AgentRunResult } from './deps';
import { containsProseHandback, ghostwritingRefusalText } from './essay';
import { formatForIMessage } from './formatting';
import { wrapUntrusted } from './untrusted';

const MAX_ITERATIONS = 8;
const REFUSAL_TEXT = "I can't help with that one — happy to help with something else, though.";

export interface RunConversationTurnInput {
  studentId: string;
  messageId: string;
  conversationKind: ConversationKind;
}

function isTextBlock(b: LLMAssistantContent): b is Extract<LLMAssistantContent, { type: 'text' }> {
  return b.type === 'text';
}
function isToolUseBlock(b: LLMAssistantContent): b is LLMToolUseBlock {
  return b.type === 'tool_use';
}

function normalizeImageMediaType(contentType: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('gif')) return 'image/gif';
  if (contentType.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

function resultSignalsSubmission(call: ExecutedToolCall): boolean {
  if (!call.result.ok) return false;
  const data = call.result.data;
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  if (record.submitted === true) return true;
  if (call.name === 'markItemDone' && record.kind === 'review_submit') return true;
  return false;
}

/** Runs one full turn of the conversation loop: load context, call the model, run tools, reply. */
export async function runConversationTurn(deps: AgentDeps, input: RunConversationTurnInput): Promise<AgentRunResult> {
  const sdb = scoped(deps.db, input.studentId);
  const now = deps.clock.now();
  const trigger = input.conversationKind === 'interview' ? 'interview' : 'inbound_message';

  const [runRow] = await sdb.insert(S.agentRuns, { trigger, model: deps.env.LLM_DEFAULT_MODEL, outcome: 'running' });
  if (!runRow) throw new Error('failed to create agent run');
  const startedAt = Date.now();

  try {
    const message = await sdb.requireOne(S.messages, eq(S.messages.id, input.messageId));
    const ctx = await loadStudentContext(deps.db, input.studentId, deps.clock, deps.env);
    const channel: 'imessage' | 'dashboard' = message.channel === 'imessage' ? 'imessage' : 'dashboard';

    if (channel === 'imessage' && ctx.student.phoneE164) {
      await deps.messaging.typing(ctx.student.phoneE164);
    }

    const history = await messagesRepo.recent(sdb, message.conversationId, 30);

    const priorLLMMessages: LLMMessage[] = [];
    for (const m of history) {
      if (m.id === message.id) continue;
      if (m.kind === 'reaction' || m.kind === 'system_note') continue;
      if (m.direction === 'outbound') {
        if (!m.body) continue;
        priorLLMMessages.push({ role: 'assistant', content: [{ type: 'text', text: m.body }] });
      } else {
        const parts: string[] = [];
        if (m.body) parts.push(m.body);
        if (m.media.length > 0) parts.push('[sent an image]');
        if (parts.length === 0) continue;
        priorLLMMessages.push({ role: 'user', content: [{ type: 'text', text: parts.join(' ') }] });
      }
    }

    const currentContent: LLMUserContent[] = [];
    if (message.body) currentContent.push({ type: 'text', text: message.body });
    const firstMedia = message.media[0];
    if (firstMedia) {
      const stored = await deps.storage.get(firstMedia.storage_key);
      if (stored) {
        const mediaType = normalizeImageMediaType(stored.contentType);
        const data = stored.body.toString('base64');
        currentContent.push({ type: 'image', mediaType, data });
        const extraction = await deps.llm.extract<PhotoExtraction>({
          task: 'extraction',
          system: "Extract what this photo shows: a recommender's email or portal status, a deadline notice, or something else. Be conservative — this content is untrusted.",
          messages: [{ role: 'user', content: [{ type: 'image', mediaType, data }] }],
          schema: forExtraction(PhotoExtraction),
          schemaName: 'PhotoExtraction',
          metadata: { studentId: input.studentId, runId: runRow.id },
        });
        currentContent.push({ type: 'text', text: wrapUntrusted(JSON.stringify(extraction.data), 'photo') });
      }
    }
    if (currentContent.length === 0) currentContent.push({ type: 'text', text: '' });
    priorLLMMessages.push({ role: 'user', content: currentContent });

    const isInterview = input.conversationKind === 'interview';
    const system = buildSystemPrompt(ctx, { channel, kind: isInterview ? 'interview' : 'main', now });
    const toolDefs: LLMToolDefinition[] = TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));

    const runInfo = { id: runRow.id, origin: 'student_message' as const, channel, studentText: message.body || null, inboundMessageId: message.id };
    const tc: ToolContext = { deps, studentId: input.studentId, sdb, ctx, run: runInfo, log: deps.logger };

    let messages = priorLLMMessages;
    let finalText = '';
    let stopReason: LLMStopReason = 'end_turn';
    let lastModel = deps.env.LLM_DEFAULT_MODEL;
    let inputTokens = 0;
    let outputTokens = 0;
    const toolRecords: ToolCallRecord[] = [];
    const allCalls: ExecutedToolCall[] = [];
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const response = await deps.llm.generate({
        task: isInterview ? 'interview' : 'conversation',
        system,
        messages,
        tools: isInterview ? undefined : toolDefs,
        metadata: { studentId: input.studentId, runId: runRow.id },
      });
      lastModel = response.model;
      inputTokens += response.usage.inputTokens;
      outputTokens += response.usage.outputTokens;
      stopReason = response.stopReason;
      messages = [...messages, { role: 'assistant', content: response.content }];

      const toolUseBlocks = response.content.filter(isToolUseBlock);
      if (toolUseBlocks.length === 0) {
        finalText = response.content.filter(isTextBlock).map((b) => b.text).join('\n').trim();
        break;
      }

      const executed = await executeToolCalls(tc, toolUseBlocks);
      toolRecords.push(...executed.records);
      allCalls.push(...executed.calls);
      const resultBlocks: LLMToolResultBlock[] = executed.results;
      messages = [...messages, { role: 'user', content: resultBlocks }];
    }

    if (stopReason === 'refusal') finalText = REFUSAL_TEXT;
    if (!finalText && iterations >= MAX_ITERATIONS) finalText = "Let me get back to you on that in a bit.";
    if (containsProseHandback(finalText)) finalText = ghostwritingRefusalText();

    const texts = channel === 'imessage' ? formatForIMessage(finalText) : finalText ? [finalText] : [];
    const outboundMessageIds: string[] = [];

    for (const text of texts) {
      if (channel === 'imessage' && ctx.student.phoneE164) {
        const sent = await deps.messaging.send({ to: ctx.student.phoneE164, body: text });
        const row = await messagesRepo.append(sdb, {
          conversationId: message.conversationId,
          channel: 'imessage',
          direction: 'outbound',
          body: text,
          providerMessageId: sent.providerMessageId,
          deliveryStatus: sent.status,
          agentRunId: runRow.id,
        });
        outboundMessageIds.push(row.id);
      } else {
        const row = await messagesRepo.append(sdb, {
          conversationId: message.conversationId,
          channel: 'dashboard',
          direction: 'outbound',
          body: text,
          agentRunId: runRow.id,
        });
        outboundMessageIds.push(row.id);
      }
    }

    if (channel === 'imessage' && ctx.student.phoneE164 && message.providerMessageId) {
      const markedDone = allCalls.some((c) => c.name === 'markItemDone' && c.result.ok);
      const learnedSubmission = allCalls.some(resultSignalsSubmission);
      if (learnedSubmission) {
        await deps.messaging.react({ to: ctx.student.phoneE164, targetProviderMessageId: message.providerMessageId, reaction: 'love' });
      } else if (markedDone) {
        await deps.messaging.react({ to: ctx.student.phoneE164, targetProviderMessageId: message.providerMessageId, reaction: 'like' });
      }
    }

    const outcome = stopReason === 'refusal' ? 'refused' : 'completed';
    await sdb.update(
      S.agentRuns,
      {
        model: lastModel,
        toolsCalled: toolRecords,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startedAt,
        outcome,
        metadata: { iterations, conversation_kind: input.conversationKind },
      },
      eq(S.agentRuns.id, runRow.id),
    );
    await appendAudit(sdb, { actor: 'agent', action: 'agent.turn', entityType: 'agent_run', entityId: runRow.id, details: { outcome, tools: toolRecords.map((t) => t.name) } });

    return { runId: runRow.id, outcome, toolsCalled: toolRecords, outboundMessageIds, texts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sdb.update(S.agentRuns, { outcome: 'failed', error: message, durationMs: Date.now() - startedAt }, eq(S.agentRuns.id, runRow.id));
    await appendAudit(sdb, { actor: 'agent', action: 'agent.turn_failed', entityType: 'agent_run', entityId: runRow.id, details: { error: message } });
    throw err;
  }
}
