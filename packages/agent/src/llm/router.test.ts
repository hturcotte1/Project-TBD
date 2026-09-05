import { describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from '@apogee/shared/config';
import { modelForTask } from './router';

function testEnv() {
  resetEnvCache();
  return loadEnv({
    ...process.env,
    LLM_DEFAULT_MODEL: 'test-default-model',
    LLM_STRONG_MODEL: 'test-strong-model',
  });
}

describe('modelForTask', () => {
  const env = testEnv();

  it.each(['conversation', 'interview', 'extraction', 'prioritization', 'reminder_draft'] as const)(
    '%s routes to the default model',
    (task) => {
      expect(modelForTask(task, env)).toBe('test-default-model');
    },
  );

  it.each(['essay_feedback', 'weekly_plan', 'reconcile'] as const)('%s routes to the strong model', (task) => {
    expect(modelForTask(task, env)).toBe('test-strong-model');
  });
});
