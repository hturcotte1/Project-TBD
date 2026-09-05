# Deploying to production

Target topology: Vercel (web) · Fly.io (api + worker) · Upstash (Redis) · Supabase (Postgres + Storage) · Browserbase · Sendblue · Anthropic · Clerk.

## 0. Accounts and keys to create

| Service | What to create | Env vars |
|---|---|---|
| Supabase | Project; note the **session-mode** connection string; create a private Storage bucket `documents`; enable S3 access keys (Storage → S3) | `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `STORAGE_PROVIDER=s3` |
| Upstash | Redis database (regional, same region as Fly) | `REDIS_URL` (use the `rediss://` URL) |
| Anthropic | API key | `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic` |
| Sendblue | Account with a dedicated number; set the inbound webhook to `https://<api-host>/webhooks/sendblue`; set a signing secret | `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET_KEY`, `SENDBLUE_PHONE_NUMBER`, `SENDBLUE_WEBHOOK_SECRET`, `MESSAGING_PROVIDER=sendblue` |
| Browserbase | Project + API key | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `BROWSER_PROVIDER=browserbase`, `MOCK_COMMONAPP=false` |
| Clerk | Application; enable email + phone sign-in | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `AUTH_MODE=clerk` |
| You | 32-byte key: `openssl rand -base64 32` | `CREDENTIALS_ENCRYPTION_KEYS=1:<base64>`, `CREDENTIALS_ENCRYPTION_KEY_VERSION=1` |

Also set `APP_URL` (the Vercel URL), `API_URL` (the Fly API URL), `ADMIN_EMAILS`, `AGENT_NAME`, `AUTONOMY_LEVEL=B`, `NODE_ENV=production`.

## 1. Database

```bash
DATABASE_URL=postgres://... pnpm db:migrate     # applies packages/shared/drizzle/*
DATABASE_URL=postgres://... pnpm --filter @apogee/shared exec tsx src/seed/schools.ts   # loads the school dataset (no demo student)
```

Migrations are also safe to run from the API container on boot (`node dist/index.js --migrate`), but running them from CI before deploy is the recommended path.

## 2. API on Fly.io

```bash
fly launch --no-deploy --dockerfile apps/api/Dockerfile --name apogee-api
fly secrets set DATABASE_URL=... REDIS_URL=... ANTHROPIC_API_KEY=... SENDBLUE_API_KEY_ID=... SENDBLUE_API_SECRET_KEY=... SENDBLUE_PHONE_NUMBER=... SENDBLUE_WEBHOOK_SECRET=... CLERK_SECRET_KEY=... CREDENTIALS_ENCRYPTION_KEYS=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=...
fly deploy --dockerfile apps/api/Dockerfile
```

`fly.toml` for the API: internal port 4000, `[http_service]` with `force_https = true`, one shared-cpu-1x machine with 512 MB is enough for a handful of students. Health check: `GET /health`.

## 3. Worker on Fly.io

```bash
fly launch --no-deploy --dockerfile apps/worker/Dockerfile --name apogee-worker
fly secrets set <same secrets as the API plus> BROWSERBASE_API_KEY=... BROWSERBASE_PROJECT_ID=...
fly deploy --dockerfile apps/worker/Dockerfile
```

The worker has no HTTP service. Run exactly one machine (the scheduler tick assumes a single worker for the repeatable job; BullMQ deduplicates by job id so two workers are safe, just unnecessary). Give it 1 GB (Playwright is only used locally in `MOCK_COMMONAPP` mode, but Stagehand fallback and PDF extraction like the headroom).

## 4. Web on Vercel

Import the repo, set root directory `apps/web`, framework Next.js, build command `pnpm --filter @apogee/web build`, install command `pnpm install --frozen-lockfile`. Env: `API_URL`, `APP_URL`, `AUTH_MODE=clerk`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`.

Clerk: add the Vercel domain to the Clerk app; in Clerk's JWT template leave the default (the API resolves the email through the Clerk backend SDK).

## 5. Wire the webhook and test

1. In Sendblue, point the webhook at `https://<api>/webhooks/sendblue` and set the signing secret to `SENDBLUE_WEBHOOK_SECRET`.
2. Text the number from a phone that belongs to a seeded/onboarded student. The API stores the message, the worker replies.
3. In the admin panel (`/admin`), press "Run sync now" for that student and watch the browser job, the Browserbase replay link, and the snapshot diff.

## 6. Operations

- **Key rotation**: add `2:<newkey>` to `CREDENTIALS_ENCRYPTION_KEYS`, set `CREDENTIALS_ENCRYPTION_KEY_VERSION=2`, redeploy; credentials are re-encrypted on next use (`rotateSecret`). Remove key 1 once no row has `key_version = 1`.
- **Site drift**: when Common App changes its DOM, extraction confidence drops and `/admin` shows a `SITE_DRIFT` alert. Update `packages/browser/src/commonapp-map.ts`, re-record fixtures with `RECORD_FIXTURES=true`, run the extractor tests, redeploy the worker.
- **Logs**: JSON to stdout with `requestId`/`jobId`; ship with Fly's log drain. Credentials, cookies, codes, and essay bodies are redacted at the logger.
- **Backups**: Supabase point-in-time recovery covers Postgres; Storage objects are keyed by student id so account deletion can remove them by prefix.
