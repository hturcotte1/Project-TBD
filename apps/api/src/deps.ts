/** Every adapter a route handler needs, injected so tests can supply fakes/doubles. */
import type { Redis } from 'ioredis';
import type { MessagingProvider, StorageProvider, VerificationCodeChannel } from '@tbd/shared/adapters';
import type { Env } from '@tbd/shared/config';
import type { Db } from '@tbd/shared/db';
import type { JobEnqueuer } from '@tbd/shared/jobs';
import type { Logger } from '@tbd/shared/logging';
import type { Clock } from '@tbd/shared/time';

export interface ApiDeps {
  db: Db;
  env: Env;
  logger: Logger;
  enqueuer: JobEnqueuer;
  messaging: MessagingProvider;
  storage: StorageProvider;
  codeChannel: VerificationCodeChannel;
  redis: Redis | null;
  clock: Clock;
}
