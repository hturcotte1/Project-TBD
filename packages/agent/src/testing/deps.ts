import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskStorageProvider, MemoryVerificationCodeChannel } from '@apogee/shared/adapters';
import { loadEnv } from '@apogee/shared/config';
import { conversationsRepo, messagesRepo, scoped, type Db } from '@apogee/shared/db';
import { MemoryJobEnqueuer } from '@apogee/shared/jobs';
import { createLogger } from '@apogee/shared/logging';
import type { ConversationKind } from '@apogee/shared/domain';
import type { MediaRef } from '@apogee/shared/schemas';
import { FixedClock } from '@apogee/shared/time';
import { RuleBasedFakeLLM } from '../llm/fake';
import type { AgentDeps } from '../runtime/deps';
import { InMemoryMessagingProvider } from './messaging';

/** A fully-wired `AgentDeps` for tests: RuleBasedFakeLLM, in-memory messaging/queue/storage, a fixed clock. */
export function buildTestDeps(db: Db, overrides: Partial<AgentDeps> = {}): AgentDeps {
  const env = loadEnv();
  return {
    db,
    llm: new RuleBasedFakeLLM(),
    messaging: new InMemoryMessagingProvider(),
    enqueuer: new MemoryJobEnqueuer(),
    storage: new LocalDiskStorageProvider(join(tmpdir(), `agent-test-${randomUUID()}`), 'http://localhost:4000'),
    codeChannel: new MemoryVerificationCodeChannel(),
    clock: new FixedClock('2026-09-04T15:00:00Z'),
    logger: createLogger({ name: 'agent-test', level: 'silent' }),
    env,
    ...overrides,
  };
}

/** Records an inbound message (creating the conversation if needed) and returns its id, as the API/webhook would before enqueueing `agent.inbound_message`. */
export async function sendInboundText(
  db: Db,
  studentId: string,
  body: string,
  opts: { conversationKind?: ConversationKind; media?: MediaRef[] } = {},
): Promise<{ messageId: string; conversationId: string }> {
  const sdb = scoped(db, studentId);
  const conversation = await conversationsRepo.getOrCreate(sdb, opts.conversationKind ?? 'main');
  const row = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'inbound',
    body,
    media: opts.media ?? [],
    providerMessageId: `inbound-${randomUUID()}`,
  });
  return { messageId: row.id, conversationId: conversation.id };
}
