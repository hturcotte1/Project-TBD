import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { AUTONOMY_LEVELS } from '../domain/enums';
import { applyDotEnv } from './dotenv';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

/**
 * Every environment variable the system reads, validated once at process start.
 * Secrets are never logged; `describeEnv()` prints only booleans for them.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('info'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  API_PORT: z.coerce.number().int().default(4000),
  AGENT_NAME: z.string().min(1).default('Remy'),
  AUTONOMY_LEVEL: z.enum(AUTONOMY_LEVELS).default('B'),

  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/tbd'),
  DATABASE_URL_TEST: z.string().default('postgres://postgres:postgres@localhost:5432/tbd_test'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  AUTH_MODE: z.enum(['dev', 'clerk']).default('dev'),
  DEV_AUTH_SECRET: z.string().min(8).default('dev-secret-change-me'),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),

  LLM_PROVIDER: z.enum(['fake', 'anthropic']).default('fake'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_DEFAULT_MODEL: z.string().default('claude-sonnet-5'),
  LLM_STRONG_MODEL: z.string().default('claude-opus-5'),

  MESSAGING_PROVIDER: z.enum(['fake', 'sendblue']).default('fake'),
  SENDBLUE_API_KEY_ID: z.string().optional(),
  SENDBLUE_API_SECRET_KEY: z.string().optional(),
  SENDBLUE_PHONE_NUMBER: z.string().optional(),
  SENDBLUE_WEBHOOK_SECRET: z.string().optional(),

  BROWSER_PROVIDER: z.enum(['local', 'browserbase']).default('local'),
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  MOCK_COMMONAPP: bool.default(true),
  COMMONAPP_BASE_URL: z.string().url().default('https://apply.commonapp.org'),
  COMMONAPP_MOCK_PORT: z.coerce.number().int().default(4100),
  COMMONAPP_MOCK_VERIFICATION_CODE: z.string().optional(),
  RECORD_FIXTURES: bool.default(false),
  STAGEHAND_FALLBACK: bool.default(false),
  /** Explicit Chromium binary for BROWSER_PROVIDER=local (when Playwright's bundled revision is absent). */
  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: z.string().optional(),

  CREDENTIALS_ENCRYPTION_KEYS: z.string().default('1:ZGV2LWtleS1kZXYta2V5LWRldi1rZXktZGV2LWtleSE='),
  CREDENTIALS_ENCRYPTION_KEY_VERSION: z.coerce.number().int().default(1),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.data/storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  FEATURE_GMAIL: bool.default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
});
export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** The monorepo root (the directory holding pnpm-workspace.yaml), so relative paths mean the same thing in every process. */
export function repoRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

/** Parse process.env once. Throws a readable error listing every invalid variable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  if (source === process.env) applyDotEnv();
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${issues}`);
  }
  const env = parsed.data;
  if (env.MOCK_COMMONAPP) env.COMMONAPP_BASE_URL = `http://localhost:${env.COMMONAPP_MOCK_PORT}`;
  if (!isAbsolute(env.STORAGE_LOCAL_DIR)) env.STORAGE_LOCAL_DIR = resolve(repoRoot(), env.STORAGE_LOCAL_DIR);
  if (source === process.env) cached = env;
  return env;
}

/** Test helper: forget the cached env so a test can change process.env. */
export function resetEnvCache(): void {
  cached = null;
}

const SECRET_KEYS: (keyof Env)[] = [
  'DATABASE_URL',
  'DATABASE_URL_TEST',
  'REDIS_URL',
  'DEV_AUTH_SECRET',
  'CLERK_SECRET_KEY',
  'ANTHROPIC_API_KEY',
  'SENDBLUE_API_KEY_ID',
  'SENDBLUE_API_SECRET_KEY',
  'SENDBLUE_WEBHOOK_SECRET',
  'BROWSERBASE_API_KEY',
  'CREDENTIALS_ENCRYPTION_KEYS',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'GOOGLE_CLIENT_SECRET',
  'COMMONAPP_MOCK_VERIFICATION_CODE',
];

/** Safe-to-log view of the env: secrets become "set"/"unset". */
export function describeEnv(env: Env): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = SECRET_KEYS.includes(k as keyof Env) ? (v ? 'set' : 'unset') : v;
  }
  return out;
}
