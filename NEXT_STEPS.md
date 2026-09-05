# Next steps: running this for real students next week

## 1. Accounts and keys to create (one afternoon)

| What | Why | Where it goes |
|---|---|---|
| Anthropic API key | Every conversation, extraction, and essay-feedback call | `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic` |
| Sendblue account + number | iMessage in and out | `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET_KEY`, `SENDBLUE_PHONE_NUMBER`, `SENDBLUE_WEBHOOK_SECRET`, `MESSAGING_PROVIDER=sendblue` |
| Browserbase project | Cloud browser with session replay | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `BROWSER_PROVIDER=browserbase`, `MOCK_COMMONAPP=false` |
| Supabase project | Postgres + object storage | `DATABASE_URL`, `S3_*`, `STORAGE_PROVIDER=s3` |
| Upstash Redis | Queues and the verification-code channel | `REDIS_URL` |
| Clerk application | Student sign-in | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `AUTH_MODE=clerk` |
| Fly.io + Vercel | Hosting | see DEPLOY.md |
| A 32-byte key | Credential encryption | `CREDENTIALS_ENCRYPTION_KEYS=1:<base64>` |

Then follow DEPLOY.md end to end, and set `ADMIN_EMAILS` to your own address so `/admin` works.

## 2. First live checks, in order

1. **Model smoke test.** `pnpm test:live` (needs the key). Then send "what's next" from the dashboard chat as the Demo Student and read the reply and the tool calls in `/activity`. Confirm `messages.parse` accepts the hand-built structured-output format (KNOWN_GAPS.md item 2).
2. **Sendblue round trip.** Text the number from your own phone. Check `/webhooks/sendblue` accepted the signature (look for `sb-signing-secret` handling in `packages/messaging/src/sendblue.ts`; if Sendblue uses a different header, change that one line). Confirm the reply, the typing indicator, and a tapback (`react`).
3. **Common App with a test account you own.** Set `RECORD_FIXTURES=true`, connect the account in Settings, run "Sync now", and open the Browserbase replay. Compare each recorded page in `packages/browser/fixtures/recorded/` with the mock; fix selectors in `commonapp-map.ts`; rerun the extractor tests.

## 3. Common App pages to have a human check first (highest risk first)

1. **Login and verification code** (`login`, `verification` pages): the code entry may be a modal or multi-box input rather than one field; "remember this device" may be named differently.
2. **My Colleges list** (`my_colleges`): plan and deadline labels per college; the `common_app_college_id` is currently the school slug in the mock, the real id must be captured from the URL.
3. **Per-college Recommenders & FERPA** (`college_recommenders`): the real page groups counselor/teacher/other differently and shows invite/submit dates in its own format.
4. **Writing Supplement and Questions** (`college_writing_supplement`, `college_questions`): supplement titles must match the dataset titles for reconciliation; the mock's question field names (`q_intended_major`, ...) are illustrative.
5. **Activities writer** (`ca_activities` form): production almost certainly uses a per-activity modal; the writer's field paths are defined in `packages/shared/src/domain/fill.ts` and will need a new mapping.
6. **Review & Submit** (`college_review_submit`): read-only; the guard must keep refusing every click on it. Verify the visible text of the real submit button matches `FORBIDDEN_ACTION_PATTERNS`.
7. **Common App tab section statuses** (`ca_profile` ... `ca_courses_grades`): status badges and their wording.

## 4. Before inviting strangers

- Review the persona prompt in `packages/agent/src/persona.ts` with the real model in the loop for tone; adjust the fake-LLM rules only for tests.
- Decide the daily cap defaults (chill 1 / normal 3 / intense 6) after a week of logs.
- Turn on the morning-plan and weekly-plan texts by leaving the scheduler running (they are on by default) and watch `/admin` for failed jobs and site-drift alerts every morning.
- Read PRIVACY.md with a lawyer's eye and link it from your marketing page.

## 5. Flipping to autonomy level C (submit on approval)

Level C is designed as a config flip, not a rewrite:

1. Set `AUTONOMY_LEVEL=C`. The API then accepts approvals of kind `submit` (today it returns 403).
2. Add a `browser.submit` job kind in `packages/shared/src/jobs/definitions.ts` and a handler in `apps/worker/src/jobs/browser/` that runs only from an approved `submit` approval, re-reads the Review page, and records a screenshot before and after.
3. In `packages/browser`, add a `submitApplication()` method that uses an explicitly relaxed page wrapper for exactly one click on the review page; the global `SafePage` guard stays as it is for every other job. Add the fee/payment step as a separate approval kind so paying is never bundled with submitting.
4. Add the agent tool `proposeSubmit` (student-text authorization, requires the student to name the school), the dashboard "Submit" button behind the same approval, and the audit action `submit.completed`.
5. Extend the adversarial tests: no path may execute a submit without an approval row whose `kind = 'submit'` and `status = 'approved'`.
