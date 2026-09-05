import type { Db } from '@apogee/shared/db';
import type { LLMProvider, MessagingProvider, StorageProvider, VerificationCodeChannel } from '@apogee/shared/adapters';
import type { JobEnqueuer } from '@apogee/shared/jobs';
import type { Clock } from '@apogee/shared/time';
import type { Logger } from '@apogee/shared/logging';
import type { Env } from '@apogee/shared/config';
import type { RunOutcome } from '@apogee/shared/domain';
import type { ToolCallRecord } from '@apogee/shared/schemas';

/** Every adapter a runtime function needs, injected so tests can supply fakes/doubles. */
export interface AgentDeps {
  db: Db;
  llm: LLMProvider;
  messaging: MessagingProvider;
  enqueuer: JobEnqueuer;
  storage: StorageProvider;
  codeChannel: VerificationCodeChannel;
  clock: Clock;
  logger: Logger;
  env: Env;
}

/** What a conversation turn (or any run that sends messages) produced. */
export interface AgentRunResult {
  runId: string;
  outcome: RunOutcome;
  toolsCalled: ToolCallRecord[];
  outboundMessageIds: string[];
  texts: string[];
}
