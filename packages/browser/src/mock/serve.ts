#!/usr/bin/env node
import { loadEnv } from '@apogee/shared/config';
import { createLogger } from '@apogee/shared/logging';
import { defaultMockState } from './state';
import { startMockCommonApp } from './server';

/** CLI entry point: `tsx src/mock/serve.ts`. Reads COMMONAPP_MOCK_PORT / COMMONAPP_MOCK_VERIFICATION_CODE. */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ name: 'commonapp-mock' });
  const state = defaultMockState();
  if (env.COMMONAPP_MOCK_VERIFICATION_CODE) state.account.verificationCode = env.COMMONAPP_MOCK_VERIFICATION_CODE;

  const handle = await startMockCommonApp({ port: env.COMMONAPP_MOCK_PORT, state, logger });
  logger.info({ url: handle.url }, 'mock common app listening');

  const shutdown = async (): Promise<void> => {
    logger.info('mock common app shutting down');
    await handle.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
