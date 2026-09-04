# Task board

Status: `todo` → `in-progress` → `review` → `done`. Owner `orchestrator` = Fable 5.1; everything else = Sonnet subagent.

## Wave 0 — foundation (orchestrator)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W0-1 | ARCHITECTURE.md, DECISIONS.md, TASKS.md | root | orchestrator | done |
| W0-2 | Monorepo scaffold: pnpm workspaces, turbo, tsconfig, eslint, vitest, .env.example, docker-compose | root | orchestrator | done |
| W0-3 | `@tbd/shared`: drizzle schema, zod JSONB schemas, domain types, enums | `packages/shared/src/db`, `src/schemas` | orchestrator | done |
| W0-4 | `@tbd/shared`: adapter interfaces, api contract, job payloads, crypto, logger, config, time, dev auth | `packages/shared/src/{adapters,api,jobs,crypto,logging,config,time,auth}` | orchestrator | done |
| W0-5 | `@tbd/shared`: student-scoped repositories + cross-student test + authz scan | `packages/shared/src/db/repos`, `src/testing` | orchestrator | done |

## Wave 1 — leaf packages (parallel)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W1-A | Requirements engine: 60-school dataset, generic rules, `buildChecklist`, `reconcile`, tests | `packages/shared/src/requirements/**` | sonnet | done |
| W1-B | Prioritizer, deadline math, trigger rules, nudge policy, tests | `packages/shared/src/{prioritize,proactive}/**` | sonnet | done |
| W1-C | Messaging: Sendblue + Fake providers, webhook parsing, signature, vCard, tests | `packages/messaging/**` | sonnet | done |
| W1-D | Browser: selector map, cheerio extractors, reader, writer, session providers, guard, mock site, fixtures, tests | `packages/browser/**` | sonnet | in-progress |
| W1-E | Agent: LLM adapters, router, persona, tools, runtime, essay boundaries + adversarial tests, extractors, injection defense | `packages/agent/**` | sonnet | done |
| W1-F | Web shell: Next app, auth (Clerk + dev), API client, UI kit, layout, onboarding steps 1–7 | `apps/web/**` | sonnet | done |
| W1-G | Seed: Demo Student with 12 schools and partial Common App state | `packages/shared/src/seed/**` | sonnet | done |

## Wave 2 — apps (parallel, after Wave 1)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W2-A | API: Fastify server, auth, every contract route, webhooks, dev phone, uploads, tests | `apps/api/**` | sonnet | in-progress |
| W2-B | Worker: queues, scheduler tick, browser job handlers with pause/resume, agent runs, proactive dispatch, maintenance, tests | `apps/worker/**` | sonnet | todo |
| W2-C | Web pages: Home, Schools, Timeline (+ .ics), Essays | `apps/web/app/(dashboard)/...` | sonnet | in-progress |
| W2-D | Web pages: Recommenders, Activity, Profile, Settings, Admin, chat mirror | `apps/web/app/(dashboard)/...` | sonnet | in-progress |

## Wave 3 — integration and verification (orchestrator)

| ID | Task | Status |
|---|---|---|
| W3-1 | Integrate, `pnpm install && pnpm build && pnpm test && pnpm lint` clean | todo |
| W3-2 | `pnpm dev` brings up everything, seeds Demo Student | todo |
| W3-3 | Onboarding e2e in browser against mock Common App | todo |
| W3-4 | fullSync → snapshot → diff → items → next actions → dashboard | todo |
| W3-5 | Verification code pause/resume via fake phone | todo |
| W3-6 | Section 9 conversation tests | todo |
| W3-7 | Essay adversarial tests | todo |
| W3-8 | Proactive engine timing tests | todo |
| W3-9 | Fill-fields flow + submit guard tests | todo |
| W3-10 | Authz, webhook signature, prompt-injection tests | todo |
| W3-11 | README, DEPLOY, DECISIONS, KNOWN_GAPS, NEXT_STEPS, PRIVACY | todo |
