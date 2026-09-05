/** Every adapter a route handler needs, injected so tests can supply fakes/doubles. */
import type { Redis } from 'ioredis';
import type { MessagingProvider, StorageProvider, VerificationCodeChannel } from '@apogee/shared/adapters';
import type { Env } from '@apogee/shared/config';
import type { Db } from '@apogee/shared/db';
import type { JobEnqueuer } from '@apogee/shared/jobs';
import type { Logger } from '@apogee/shared/logging';
import type { Clock } from '@apogee/shared/time';

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
