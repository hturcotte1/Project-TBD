import type { z } from 'zod';

/** What the call is for; `modelForTask()` maps this to a model id. */
export type LLMTask =
  | 'conversation'
  | 'interview'
  | 'extraction'
  | 'prioritization'
  | 'essay_feedback'
  | 'weekly_plan'
  | 'reconcile'
  | 'reminder_draft';

export interface LLMTextBlock {
  type: 'text';
  text: string;
}
export interface LLMImageBlock {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** base64 */
  data: string;
}
export interface LLMDocumentBlock {
  type: 'document';
  mediaType: 'application/pdf';
  /** base64 */
  data: string;
}
export interface LLMToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
export interface LLMToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}
export type LLMUserContent = LLMTextBlock | LLMImageBlock | LLMDocumentBlock | LLMToolResultBlock;
export type LLMAssistantContent = LLMTextBlock | LLMToolUseBlock;
export type LLMMessage =
  | { role: 'user'; content: LLMUserContent[] }
  | { role: 'assistant'; content: LLMAssistantContent[] };

export interface LLMToolDefinition {
  name: string;
  description: string;
  /** A zod object schema; providers convert it to JSON schema. */
  inputSchema: z.ZodTypeAny;
}

export type LLMEffort = 'low' | 'medium' | 'high';

export interface LLMRequestBase {
  task: LLMTask;
  /** Explicit model override; otherwise the provider asks modelForTask(). */
  model?: string;
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  effort?: LLMEffort;
  /** Opaque identifiers for logging and cost attribution. Never secrets. */
  metadata?: { studentId?: string; runId?: string };
}

export interface LLMGenerateRequest extends LLMRequestBase {
  tools?: LLMToolDefinition[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export type LLMStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface LLMGenerateResponse {
  model: string;
  content: LLMAssistantContent[];
  stopReason: LLMStopReason;
  usage: LLMUsage;
}

export interface LLMExtractRequest<T> extends LLMRequestBase {
  schema: z.ZodType<T>;
  /** Short name for the schema, used in logs and by fakes to pick a canned response. */
  schemaName: string;
}

export interface LLMExtractResponse<T> {
  model: string;
  data: T;
  usage: LLMUsage;
}

/**
 * Every LLM call in the system goes through this. `generate` is the tool-use loop primitive;
 * `extract` returns schema-validated structured output and never free text.
 */
export interface LLMProvider {
  readonly name: 'anthropic' | 'fake';
  generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse>;
  extract<T>(req: LLMExtractRequest<T>): Promise<LLMExtractResponse<T>>;
}
