# Known gaps

What could not be completed or verified in this build, stated plainly. Everything else in the Definition of Done was run and passed (see the end of TASKS.md for the checklist).

## Not verifiable in the build environment (no vendor credentials)

1. **Real model calls.** The sandbox had no `ANTHROPIC_API_KEY`. Every conversation, extraction, essay-feedback, and proactive test ran against the deterministic `RuleBasedFakeLLM` in `packages/agent/src/llm/fake.ts`, which emulates the persona's decisions from keyword rules. The runtime, tools, authorization guard, messaging, and database paths are exercised end to end; the *judgment* of the real model is not. `AnthropicLLM` (`packages/agent/src/llm/anthropic.ts`) was written against the installed SDK's types but has never been executed. Run `pnpm test:live` with a key before real students use it, and read the note on structured outputs below.
2. **Structured outputs shape.** The SDK's `zodOutputFormat` helper expects zod v4 schemas; the shared schemas are zod v3, so `packages/agent/src/llm/schema.ts` builds the `output_config.format` object by hand with `zod-to-json-schema`. It matches the documented shape, but the first live call should confirm the API accepts it.
3. **Browserbase and Stagehand.** `BrowserbaseSessionProvider` and the Stagehand fallback extractor are implemented against the published types of `@browserbasehq/sdk` and `@browserbasehq/stagehand` v4 but were never run against a live account. The Browserbase replay URL format is assumed to be `https://www.browserbase.com/sessions/<id>`.
4. **Sendblue.** Endpoints, bodies, and the reaction API were verified against the live docs, but no message was ever sent. The docs do not name the header that carries the webhook secret; the provider checks `sb-signing-secret` (or `?secret=`) and fails closed. Confirm the real header on the first delivery. Sendblue's contact-sharing feature is not a vCard API, so the contact card is sent as a hosted `.vcf` (`GET /public/vector.vcf`) via `media_url`.
5. **Clerk.** `AUTH_MODE=clerk` is wired on both sides (`@clerk/nextjs` middleware and `@clerk/backend` token verification) and the app builds without keys, but it was not exercised. All verification ran in `AUTH_MODE=dev`.
6. **S3 / Supabase Storage.** `S3StorageProvider` is complete and typed but untested against a bucket; all runs used local disk storage.

## The Common App selector map is modeled, not observed

Every selector, page path, and extraction anchor in `packages/browser/src/commonapp-map.ts` was written against the mock site in `packages/browser/src/mock`, because the real Common App DOM was not reachable. The reader, writer, diff, guard, verification-code flow, and fixtures all work against that model. Before a real sync, a human must record the real pages (`RECORD_FIXTURES=true`) and adjust the map. NEXT_STEPS.md lists the pages in order of risk.

## Findings from the adversarial review that were fixed

An adversarial review (six reviewers, two refuters per finding) confirmed 13 defects and 4 contested ones; all were fixed in the same pass (DECISIONS.md #27–35): admin revocation, essay text in fill verifications, photo-only tool authorization, untrusted-tag escape variants, webhook marker-before-processing, delivery-status regression, media SSRF/size, unknown senders, dev routes in production, non-idempotent proactive sends, quiet-hours violation on the reconnect text, ack/snooze not suppressing recommender/essay nudges, queued-sync duplicates, student due dates overwritten by sync, and the missing recommender-invite guard patterns. One finding (the review-page URL allowlist) was refuted: selector and visible-text checks still apply on that page.

Still open from that review: Sendblue's documentation defines no webhook payload for tapback reactions, so reactions the student sends are not recorded as `reaction` messages from the real provider (they are with the fake provider).

## Product scope not built

- **Gmail read-only connector.** The feature flag, env vars, and settings card exist; the OAuth flow and mail parsing were not built.
- **College-specific question filling.** `proposeFillFields` supports `activities`, `profile`, and `personal_essay`. `college_questions` returns a clear error because there is no per-school question map yet.
- **Recommender "check" job** (`browser.check_recommenders`) reuses the full capture; it is not a lighter pass.
- **Common App RD deadlines for a few schools** and several test policies are marked `needs_verification` in the dataset; the sync clears the supplement flags it can confirm but cannot confirm deadlines the site does not show.

## Operational notes

- A worker restart while a browser job is waiting for a verification code loses that wait; BullMQ retries the job after the lock expires, and the student is asked for a new code.
- The mock Common App is served by the worker process, so its state (including a configured verification code) resets when the worker restarts.
- `pnpm test` runs packages serially because they share one test database.
- Running `next build` while `next dev` is up corrupts the dev server's `.next` directory (a Next.js limitation); either stop `pnpm dev` before `pnpm build`, or build into a separate directory with `NEXT_DIST_DIR=.next-build pnpm -F @apogee/web build`.
