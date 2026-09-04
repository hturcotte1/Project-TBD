import type { Db } from '@tbd/shared/db';
import type { LLMProvider, MessagingProvider, StorageProvider, VerificationCodeChannel } from '@tbd/shared/adapters';
import type { JobEnqueuer } from '@tbd/shared/jobs';
import type { Clock } from '@tbd/shared/time';
import type { Logger } from '@tbd/shared/logging';
import type { Env } from '@tbd/shared/config';
import type { RunOutcome } from '@tbd/shared/domain';
import type { ToolCallRecord } from '@tbd/shared/schemas';

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
