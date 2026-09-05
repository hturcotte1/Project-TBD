import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';

export function mapAgentRun(row: S.AgentRun): D.AgentRunDto {
  return {
    id: row.id,
    trigger: row.trigger,
    model: row.model,
    tools_called: row.toolsCalled,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    duration_ms: row.durationMs,
    outcome: row.outcome,
    error: row.error,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
  };
}
