import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Integration tests share one real Postgres test DB and truncate it per suite. `fileParallelism`
    // alone still let vitest run separate workers per file; pinning to a single fork forces every
    // file through one process. Vitest's default module isolation then re-evaluates test-helpers.ts
    // fresh per file, which defeats its in-process DB lock (module state doesn't carry over) — so
    // isolation is off too: every file shares one module graph, one DB lock, one execution order.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
  },
});
