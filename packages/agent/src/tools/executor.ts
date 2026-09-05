import type { LLMToolResultBlock, LLMToolUseBlock } from '@apogee/shared/adapters';
import { appendAudit } from '@apogee/shared/db';
import type { ToolCallRecord } from '@apogee/shared/schemas';
import { authorizedByStudentText, originAllows } from './authorization';
import { findTool } from './registry';
import type { ToolContext, ToolResult } from './types';

export interface ExecutedToolCall {
  name: string;
  input: unknown;
  result: ToolResult;
}

export interface ExecuteToolCallsResult {
  results: LLMToolResultBlock[];
  records: ToolCallRecord[];
  calls: ExecutedToolCall[];
}

function summarizeInput(name: string, input: unknown): string {
  if (name === 'answerVerificationCode') return 'code: [redacted]';
  if (name === 'saveEssayDraft' && typeof input === 'object' && input !== null && 'text' in input) {
    const text = String((input as { text: unknown }).text ?? '');
    const words = text.split(/\s+/).filter(Boolean).length;
    return `essay text: [redacted, ${words} words]`;
  }
  try {
    const json = JSON.stringify(input) ?? '';
    return json.length > 280 ? `${json.slice(0, 280)}…` : json;
  } catch {
    return '[unserializable input]';
  }
}

/** Validates, authorizes, times, and runs every tool call the model requested this turn. */
export async function executeToolCalls(tc: ToolContext, toolCalls: LLMToolUseBlock[]): Promise<ExecuteToolCallsResult> {
  const results: LLMToolResultBlock[] = [];
  const records: ToolCallRecord[] = [];
  const calls: ExecutedToolCall[] = [];

  for (const call of toolCalls) {
    const started = Date.now();
    const tool = findTool(call.name);

    if (!tool) {
      results.push({ type: 'tool_result', toolUseId: call.id, content: `unknown tool: ${call.name}`, isError: true });
      records.push({ name: call.name, input_summary: 'unknown tool', ok: false, duration_ms: Date.now() - started, error: 'unknown tool' });
      continue;
    }

    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      const error = `invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
      results.push({ type: 'tool_result', toolUseId: call.id, content: error, isError: true });
      records.push({ name: tool.name, input_summary: summarizeInput(tool.name, call.input), ok: false, duration_ms: Date.now() - started, error });
      continue;
    }

    const authorized =
      originAllows(tool, tc.run.origin) && (tc.run.origin === 'approval' || authorizedByStudentText(tool, tc.run.studentText, parsed.data));
    if (!authorized) {
      await appendAudit(tc.sdb, {
        actor: 'agent',
        action: 'tool_origin_blocked',
        entityType: 'tool',
        details: { tool: tool.name, origin: tc.run.origin, runId: tc.run.id },
      });
      const error = `blocked: "${tool.name}" is not authorized for a run with origin "${tc.run.origin}"`;
      results.push({ type: 'tool_result', toolUseId: call.id, content: error, isError: true });
      records.push({ name: tool.name, input_summary: summarizeInput(tool.name, call.input), ok: false, duration_ms: Date.now() - started, error: 'blocked: unauthorized origin' });
      continue;
    }

    try {
      const result = await tool.run(tc, parsed.data);
      results.push({ type: 'tool_result', toolUseId: call.id, content: result.ok ? result.summary : result.error, isError: !result.ok });
      records.push({
        name: tool.name,
        input_summary: summarizeInput(tool.name, call.input),
        ok: result.ok,
        duration_ms: Date.now() - started,
        error: result.ok ? null : result.error,
      });
      calls.push({ name: tool.name, input: parsed.data, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ type: 'tool_result', toolUseId: call.id, content: `error: ${message}`, isError: true });
      records.push({ name: tool.name, input_summary: summarizeInput(tool.name, call.input), ok: false, duration_ms: Date.now() - started, error: message });
      calls.push({ name: tool.name, input: parsed.data, result: { ok: false, error: message } });
    }
  }

  return { results, records, calls };
}
