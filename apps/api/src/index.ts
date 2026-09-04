/**
 * Bootstrap: load env, build every adapter, hand them to `buildApp`, listen, and shut down
 * gracefully. This file does the wiring only — behavior lives in `app.ts` and `routes/`.
 */
import { Redis } from 'ioredis';
import { createMessagingProvider } from '@tbd/messaging';
import { LocalDiskStorageProvider, RedisVerificationCodeChannel, S3StorageProvider } from '@tbd/shared/adapters';
import { loadEnv } from '@tbd/shared/config';
import { createDb } from '@tbd/shared/db';
import { BullJobEnqueuer } from '@tbd/shared/jobs';
import { createLogger } from '@tbd/shared/logging';
import { SystemClock } from '@tbd/shared/time';
import { buildApp } from './app';
import type { ApiDeps } from './deps';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ name: '@tbd/api', level: env.LOG_LEVEL, pretty: env.NODE_ENV !== 'production' });

  const dbHandle = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on('error', (err) => logger.error({ err }, 'redis connection error'));

  const enqueuer = new BullJobEnqueuer(redis);
  const messaging = createMessagingProvider(env, { redis, logger });

  const storage =
    env.STORAGE_PROVIDER === 's3'
      ? new S3StorageProvider({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: requireEnv(env.S3_BUCKET, 'S3_BUCKET'),
          accessKeyId: requireEnv(env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv(env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
        })
      : new LocalDiskStorageProvider(env.STORAGE_LOCAL_DIR, env.API_URL);

  const codeChannel = new RedisVerificationCodeChannel(redis, () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }));

  const deps: ApiDeps = { db: dbHandle.db, env, logger, enqueuer, messaging, storage, codeChannel, redis, clock: new SystemClock() };

  const app = buildApp(deps);
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info({ port: env.API_PORT, authMode: env.AUTH_MODE, storage: env.STORAGE_PROVIDER, messaging: env.MESSAGING_PROVIDER }, 'api listening');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      await enqueuer.close();
      redis.disconnect();
      await dbHandle.close();
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required when STORAGE_PROVIDER=s3`);
  return value;
}

main().catch((err: unknown) => {
   
  console.error(err);
  process.exit(1);
});
