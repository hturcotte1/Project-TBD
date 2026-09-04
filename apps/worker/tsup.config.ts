import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Bundle our workspace packages (they ship TS source); leave real node_modules external.
  noExternal: [/^@tbd\//],
  external: ['playwright', '@browserbasehq/stagehand', '@browserbasehq/sdk', 'bullmq', 'ioredis', 'postgres', 'cheerio', 'fastify', '@anthropic-ai/sdk'],
});
