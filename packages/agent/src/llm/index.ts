import type { Env } from '@apogee/shared/config';
import type { LLMProvider } from '@apogee/shared/adapters';
import type { Logger } from '@apogee/shared/logging';
import { AnthropicLLM } from './anthropic';
import { RuleBasedFakeLLM } from './fake';

export * from './anthropic';
export * from './errors';
export * from './fake';
export * from './router';
export * from './schema';

/** `anthropic` requires `ANTHROPIC_API_KEY`; otherwise (including `LLM_PROVIDER=fake`) falls back to the rule-based fake. */
export function createLLMProvider(env: Env, logger: Logger): LLMProvider {
  if (env.LLM_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return new AnthropicLLM(env, logger);
  }
  return new RuleBasedFakeLLM();
}
