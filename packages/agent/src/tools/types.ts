import type { z } from 'zod';
import type { StudentDb } from '@apogee/shared/db';
import type { Logger } from '@apogee/shared/logging';
import type { StudentContext } from '../context';
import type { AgentDeps } from '../runtime/deps';

export type ToolRunOrigin = 'student_message' | 'approval' | 'extracted_content' | 'system';
export type ToolRunChannel = 'imessage' | 'dashboard';

export interface ToolRunInfo {
  id: string;
  origin: ToolRunOrigin;
  channel: ToolRunChannel;
  /** The verbatim text the student sent this turn, if any (null for photo-only, proactive, or system runs). */
  studentText: string | null;
  inboundMessageId: string | null;
}

export interface ToolContext {
  deps: AgentDeps;
  studentId: string;
  sdb: StudentDb;
  ctx: StudentContext;
  run: ToolRunInfo;
  log: Logger;
}

export type ToolResult = { ok: true; data: unknown; summary: string } | { ok: false; error: string };

export type ToolAuthorization = 'any' | 'student_text';

export interface AgentTool<I extends z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: I;
  authorization: ToolAuthorization;
  run(tc: ToolContext, input: z.infer<I>): Promise<ToolResult>;
}

/** Widens a strongly-typed tool definition into the registry's common shape. Inference for `I` comes from the argument. */
export function defineTool<I extends z.ZodTypeAny>(tool: AgentTool<I>): AgentTool<z.ZodTypeAny> {
  return tool as unknown as AgentTool<z.ZodTypeAny>;
}

export function ok(data: unknown, summary: string): ToolResult {
  return { ok: true, data, summary };
}

export function fail(error: string): ToolResult {
  return { ok: false, error };
}
