# Task board

Status: `todo` → `in-progress` → `review` → `done`. Owner `orchestrator` = Fable 5.1; everything else = Sonnet subagent.

## Wave 0 — foundation (orchestrator)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W0-1 | ARCHITECTURE.md, DECISIONS.md, TASKS.md | root | orchestrator | done |
| W0-2 | Monorepo scaffold: pnpm workspaces, turbo, tsconfig, eslint, vitest, .env.example, docker-compose | root | orchestrator | done |
| W0-3 | `@apogee/shared`: drizzle schema, zod JSONB schemas, domain types, enums | `packages/shared/src/db`, `src/schemas` | orchestrator | done |
| W0-4 | `@apogee/shared`: adapter interfaces, api contract, job payloads, crypto, logger, config, time, dev auth | `packages/shared/src/{adapters,api,jobs,crypto,logging,config,time,auth}` | orchestrator | done |
| W0-5 | `@apogee/shared`: student-scoped repositories + cross-student test + authz scan | `packages/shared/src/db/repos`, `src/testing` | orchestrator | done |

## Wave 1 — leaf packages (parallel)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W1-A | Requirements engine: 60-school dataset, generic rules, `buildChecklist`, `reconcile`, tests | `packages/shared/src/requirements/**` | sonnet | done |
| W1-B | Prioritizer, deadline math, trigger rules, nudge policy, tests | `packages/shared/src/{prioritize,proactive}/**` | sonnet | done |
| W1-C | Messaging: Sendblue + Fake providers, webhook parsing, signature, vCard, tests | `packages/messaging/**` | sonnet | done |
| W1-D | Browser: selector map, cheerio extractors, reader, writer, session providers, guard, mock site, fixtures, tests | `packages/browser/**` | sonnet | done |
| W1-E | Agent: LLM adapters, router, persona, tools, runtime, essay boundaries + adversarial tests, extractors, injection defense | `packages/agent/**` | sonnet | done |
| W1-F | Web shell: Next app, auth (Clerk + dev), API client, UI kit, layout, onboarding steps 1–7 | `apps/web/**` | sonnet | done |
| W1-G | Seed: Demo Student with 12 schools and partial Common App state | `packages/shared/src/seed/**` | sonnet | done |

## Wave 2 — apps (parallel, after Wave 1)

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W2-A | API: Fastify server, auth, every contract route, webhooks, dev phone, uploads, tests | `apps/api/**` | sonnet | done |
| W2-B | Worker: queues, scheduler tick, browser job handlers with pause/resume, agent runs, proactive dispatch, maintenance, tests | `apps/worker/**` | sonnet | done |
| W2-C | Web pages: Home, Schools, Timeline (+ .ics), Essays | `apps/web/app/(dashboard)/...` | sonnet | done |
| W2-D | Web pages: Recommenders, Activity, Profile, Settings, Admin, chat mirror | `apps/web/app/(dashboard)/...` | sonnet | done |

## Wave 3 — integration and verification (orchestrator)

| ID | Task | Status |
|---|---|---|
| W3-1 | Integrate, `pnpm install && pnpm build && pnpm test && pnpm lint` clean | done — root `pnpm build`, `pnpm lint`, `pnpm test` (serial) green; fresh-clone run recorded below |
| W3-2 | `pnpm dev` brings up everything, seeds Demo Student | done — one `pnpm dev` brings up db:ready + seed, api :4000, `/dev/phone`, mock :4100, web :3000, worker |
| W3-3 | Onboarding e2e in browser against mock Common App | done — Playwright drove all 7 steps for a new student (transcript → GPA 3.7, resume → 6 activities, interview → narrative, 12 schools, connect → verified, first sync + plan, dashboard) |
| W3-4 | fullSync → snapshot → diff → items → next actions → dashboard | done — live `syncRun`: 53 pages, 53 screenshots, confidence 1.0, zero diff vs the seed; changed mock state → important change + item done (worker tests) |
| W3-5 | Verification code pause/resume via fake phone | done — mock demanded a code: job paused, one text, code typed into `/dev/phone`, job resumed (53 pages); code retained nowhere |
| W3-6 | Section 9 conversation tests | done — agent behaviors suite + live fake-phone run (what's next, Michigan status, done-with-supp with ambiguity guard, snooze to 7am, stressed, add school, activities fill) |
| W3-7 | Essay adversarial tests | done — 16 ghostwriting phrasings refused with redirects; feedback path returns specific items; prose-handback safety net |
| W3-8 | Proactive engine timing tests | done — trigger/policy tests with fixed clocks; worker tick tests (3-day countdown once, quiet-hours deferral, recommender inactivity once) |
| W3-9 | Fill-fields flow + submit guard tests | done — live: propose → approval → fill job → 72/72 verified → screenshot in audit → mock state updated; guard tests (unit, grep-level, runtime) |
| W3-10 | Authz, webhook signature, prompt-injection tests | done — StudentDb cross-student tests, authz scan, API cross-student 404s, forged webhook 401, injection fixture + origin guard tests |
| W3-11 | README, DEPLOY, DECISIONS, KNOWN_GAPS, NEXT_STEPS, PRIVACY | done — README, DEPLOY, DECISIONS, KNOWN_GAPS, NEXT_STEPS, PRIVACY |
| W3-12 | Adversarial review (6 reviewers × 2 refuters, 21 findings) and fixes | done — 13 confirmed + 4 contested fixed with tests (DECISIONS #27–35); 1 refuted; 1 documented in KNOWN_GAPS |

## Wave 4 — Apogee rename and dashboard redesign

| ID | Task | Files | Owner | Status |
|---|---|---|---|---|
| W4-1 | Rename to Apogee / Vector across packages, config, docs, persona and welcome; full test run | everywhere | orchestrator | done — commit 13c2259 |
| W4-2 | Design plan: `docs/DESIGN.md`, `tokens.css`, typeface bake-off, Tailwind on tokens only, self-hosted fonts, theme script | `docs/DESIGN.md`, `apps/web/app/{tokens.css,globals.css,fonts.ts,fonts/,layout.tsx}`, `apps/web/tailwind.config.ts` | orchestrator | done |
| W4-3 | Component system `components/system/*` (Radix underneath) + `/dev/system` kitchen sink in both themes; `lib/urgency.ts` six-step heat; `lib/theme.ts`; screenshots script skeleton | `apps/web/components/system/**`, `apps/web/app/dev/system`, `apps/web/scripts/screenshots.ts` | sonnet | done — reviewed, six findings fixed (docs/DESIGN_REVIEW.md pass 1) |
| W4-4a | Today + command palette + app shell (rail, tab bar, student menu) | `apps/web/app/(app)/{layout,page}.tsx`, `components/{shell,today,palette}` | sonnet | todo |
| W4-4b | Schools table + school detail | `apps/web/app/(app)/schools/**`, `components/schools/**` | sonnet | todo |
| W4-4c | Timeline runway + agenda | `apps/web/app/(app)/timeline`, `components/timeline/**` | sonnet | todo |
| W4-4d | Essays table + editor | `apps/web/app/(app)/essays/**`, `components/essays/**` | sonnet | todo |
| W4-4e | Recommenders table + reminder drawer; Vector chat | `apps/web/app/(app)/{recommenders,chat}`, `components/{recommenders,chat}/**` | sonnet | todo |
| W4-4f | Activity stream; Settings; Profile; Admin | `apps/web/app/(app)/{activity,settings,profile,admin}`, `components/{activity,settings,profile,admin}/**` | sonnet | todo |
| W4-4g | Onboarding (one question per screen), sign-in, dev login, empty states | `apps/web/app/(onboarding)/**`, `app/sign-in`, `app/dev/login`, `components/onboarding/**` | sonnet | todo |
| W4-5 | Review pass 1 and 2 with notes in `docs/DESIGN_REVIEW.md`; fixes; copy pass; delete `components/ui`; DoD greps; fresh-clone build/test/lint; `docs/screenshots` committed; KNOWN_GAPS and DECISIONS | root | orchestrator | todo |
