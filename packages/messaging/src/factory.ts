import type { Redis } from 'ioredis';
import type { MessagingProvider } from '@tbd/shared/adapters';
import type { Env } from '@tbd/shared/config';
import { createLogger, type Logger } from '@tbd/shared/logging';
import { FakeMessagingProvider } from './fake';
import { SendblueProvider } from './sendblue';

export interface MessagingProviderDeps {
  redis?: Redis;
  logger?: Logger;
}

/**
 * Builds the `MessagingProvider` named by `env.MESSAGING_PROVIDER`. `sendblue` requires the
 * SENDBLUE_* vars to be set (throws a readable error naming exactly what's missing); anything
 * else (including the default, `fake`) returns a `FakeMessagingProvider`.
 */
export function createMessagingProvider(env: Env, deps: MessagingProviderDeps = {}): MessagingProvider {
  const logger = deps.logger ?? createLogger({ name: 'messaging-provider' });

  if (env.MESSAGING_PROVIDER === 'sendblue') {
    const missing: string[] = [];
    if (!env.SENDBLUE_API_KEY_ID) missing.push('SENDBLUE_API_KEY_ID');
    if (!env.SENDBLUE_API_SECRET_KEY) missing.push('SENDBLUE_API_SECRET_KEY');
    if (!env.SENDBLUE_PHONE_NUMBER) missing.push('SENDBLUE_PHONE_NUMBER');
    if (missing.length > 0) {
      throw new Error(`MESSAGING_PROVIDER=sendblue requires the following env vars: ${missing.join(', ')}`);
    }
    return new SendblueProvider({
      apiKeyId: env.SENDBLUE_API_KEY_ID as string,
      apiSecretKey: env.SENDBLUE_API_SECRET_KEY as string,
      phoneNumber: env.SENDBLUE_PHONE_NUMBER as string,
      webhookSecret: env.SENDBLUE_WEBHOOK_SECRET ?? null,
      // No dedicated env var for this; the API mounts the Sendblue webhook at a fixed path
      // (see ARCHITECTURE.md), so we derive the default status-callback URL from API_URL.
      statusCallbackUrl: `${env.API_URL.replace(/\/$/, '')}/webhooks/sendblue`,
      logger,
    });
  }

  return new FakeMessagingProvider({ redis: deps.redis, logger });
}
