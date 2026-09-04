import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock as SdkContentBlock,
  ContentBlockParam as SdkContentBlockParam,
  MessageParam as SdkMessageParam,
  StopReason as SdkStopReason,
  Tool as SdkTool,
} from '@anthropic-ai/sdk/resources/messages';
import type { Env } from '@tbd/shared/config';
import type { Logger } from '@tbd/shared/logging';
import type {
  LLMAssistantContent,
  LLMExtractRequest,
  LLMExtractResponse,
  LLMGenerateRequest,
  LLMGenerateResponse,
  LLMMessage,
  LLMProvider,
  LLMStopReason,
  LLMUserContent,
} from '@tbd/shared/adapters';
import { LLMExtractionError } from './errors';
import { modelForTask } from './router';
import { structuredOutputFormat, toJsonSchema } from './schema';

const DEFAULT_MAX_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

function toSdkContentBlock(block: LLMUserContent | LLMAssistantContent): SdkContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'image':
      return { type: 'image', source: { type: 'base64', media_type: block.mediaType, data: block.data } };
    case 'document':
      return { type: 'document', source: { type: 'base64', media_type: block.mediaType, data: block.data } };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    case 'tool_result':
      return { type: 'tool_result', tool_use_id: block.toolUseId, content: block.content, is_error: block.isError };
  }
}

function toSdkMessages(messages: LLMMessage[]): SdkMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content.map(toSdkContentBlock) }));
}

function fromSdkContent(content: SdkContentBlock[]): LLMAssistantContent[] {
  const out: LLMAssistantContent[] = [];
  for (const block of content) {
    if (block.type === 'text') out.push({ type: 'text', text: block.text });
    else if (block.type === 'tool_use') out.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
  }
  return out;
}

function mapStopReason(reason: SdkStopReason | null): LLMStopReason {
  switch (reason) {
    case 'end_turn':
      return 'end_turn';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

/** `LLMProvider` backed by the real Anthropic API (`@anthropic-ai/sdk`). */
export class AnthropicLLM implements LLMProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(
    private readonly env: Env,
    private readonly logger: Logger,
  ) {
    if (!env.ANTHROPIC_API_KEY) throw new Error('AnthropicLLM requires ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS });
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const model = req.model ?? modelForTask(req.task, this.env);
    const tools: SdkTool[] | undefined = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: toJsonSchema(t.inputSchema) as SdkTool['input_schema'],
    }));
    const response = await this.client.messages.create({
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: req.system,
      messages: toSdkMessages(req.messages),
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(req.effort ? { output_config: { effort: req.effort } } : {}),
    });
    this.logger.info(
      {
        task: req.task,
        model: response.model,
        studentId: req.metadata?.studentId,
        runId: req.metadata?.runId,
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      'llm.generate',
    );
    return {
      model: response.model,
      content: fromSdkContent(response.content),
      stopReason: mapStopReason(response.stop_reason),
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }

  async extract<T>(req: LLMExtractRequest<T>): Promise<LLMExtractResponse<T>> {
    const model = req.model ?? modelForTask(req.task, this.env);
    const format = structuredOutputFormat(req.schema, req.schemaName);
    const message = await this.client.messages.parse({
      model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: req.system,
      messages: toSdkMessages(req.messages),
      output_config: { format, ...(req.effort ? { effort: req.effort } : {}) },
    });
    this.logger.info(
      {
        task: req.task,
        schemaName: req.schemaName,
        model: message.model,
        studentId: req.metadata?.studentId,
        runId: req.metadata?.runId,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
      'llm.extract',
    );
    if (message.parsed_output === null) {
      throw new LLMExtractionError(req.schemaName, 'model returned no parsed_output');
    }
    return {
      model: message.model,
      data: message.parsed_output,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  }
}
