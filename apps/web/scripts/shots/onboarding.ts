import type { Page } from 'playwright';
import { getQuestions } from '../../components/onboarding/step-questions';
import type { Shot } from './types';

/** The exact `data` shape `onboardingStep` expects for each step, in order — see
 * `packages/shared/src/api/contract.ts` (`OnboardingStepBody`). Every object-valued field below
 * relies on its schema's own defaults where the actual value doesn't matter for a screenshot.
 * `phone_e164` must be unique per student, so it's built fresh for each newly minted account. */
function stepBodies(phoneE164: string) {
  return [
    {
      step: 1,
      data: {
        first_name: 'Riley',
        last_name: 'Chen',
        preferred_name: 'Riley',
        phone_e164: phoneE164,
        high_school: 'Lincoln High School',
        graduation_year: 2027,
        timezone: 'America/Chicago',
        quiet_hours: { start: '22:00', end: '07:00' },
        nudge_intensity: 'normal',
      },
    },
    { step: 2, data: { academics: {}, test_scores: {} } },
    { step: 3, data: { activities: [] } },
    { step: 4, data: { narrative_confirmed: true } },
    { step: 5, data: { goals: {}, demographics: {}, applications: [{ school_name: 'Example State University', plan: 'RD' }] } },
    { step: 6, data: { acknowledged: true } },
  ];
}

/** A fresh, valid-looking US E.164 number, unique enough not to collide across screenshot runs. */
function randomPhone(): string {
  return `+1555${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
}

/**
 * Every onboarding shot needs its own never-before-seen student, not just a shared "onboard@…"
 * account: the screenshot runner captures one Shot across four (theme, width) contexts within a
 * single process run, and step 7 completes onboarding for real (a one-way move — a second attempt
 * on the same account lands on `/`, not `/onboarding/7`). Replicates `signIn` from
 * `scripts/screenshots.ts` since that file isn't this area's to edit.
 */
async function freshDevSignIn(page: Page, origin: string): Promise<void> {
  const email = `onboard-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
  const response = await page.request.post(`${origin}/dev/session`, { form: { email, redirect_url: '/' }, maxRedirects: 0 });
  const setCookie = (await response.headersArray()).find((header) => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('apogee_dev_session='));
  if (!setCookie) throw new Error(`dev sign-in at ${origin}/dev/session did not return an apogee_dev_session cookie (status ${response.status()})`);
  const rest = setCookie.value.slice('apogee_dev_session='.length);
  const value = rest.includes(';') ? rest.slice(0, rest.indexOf(';')) : rest;
  await page.context().addCookies([{ name: 'apogee_dev_session', value, domain: new URL(origin).hostname, path: '/' }]);

  // A brand-new email auto-provisions its student row on first authenticated request. The
  // onboarding layout and its step page each independently fetch onboarding state as part of the
  // same route render, so the very first navigation would otherwise race two inserts for the same
  // row — one blocking request here settles the insert before that navigation ever happens.
  const warmup = await page.request.get(`${origin}/api/proxy/me`);
  if (!warmup.ok()) throw new Error(`warm-up GET /me failed for a freshly signed-in student: ${warmup.status()}`);
}

/** Signs in as a fresh student, completes every step before `targetStep` via the same
 * `onboardingStep` calls the UI itself sends (fastest way to reach a deep step — see the
 * onboarding spec), then navigates to it and waits for its first question. */
async function prepareThroughStep(page: Page, targetStep: number): Promise<void> {
  const origin = new URL(page.url()).origin;
  await freshDevSignIn(page, origin);

  for (const body of stepBodies(randomPhone()).slice(0, targetStep - 1)) {
    // Step 4 requires a narrative row to already exist (the interview chat normally creates one
    // via narrativeSummarize + narrativeUpdate before the student ever reaches "confirm").
    if (body.step === 4) {
      const narrativeRes = await page.request.put(`${origin}/api/proxy/narrative`, { data: {} });
      if (!narrativeRes.ok()) throw new Error(`narrativeUpdate failed while preparing step ${targetStep}: ${narrativeRes.status()}`);
    }
    const response = await page.request.post(`${origin}/api/proxy/onboarding/step`, { data: body });
    if (!response.ok()) throw new Error(`onboardingStep ${body.step} failed while preparing step ${targetStep}: ${response.status()}`);
  }
  await page.goto(`${origin}/onboarding/${targetStep}`, { waitUntil: 'networkidle' });
  const firstQuestion = getQuestions(targetStep)[0];
  if (firstQuestion) await page.getByRole('heading', { level: 1, name: firstQuestion.label }).waitFor({ state: 'visible' });
}

/** Screens owned by the onboarding page task. */
export const SHOTS: Shot[] = [
  { name: 'signin', path: '/dev/login', anonymous: true },
  ...Array.from({ length: 7 }, (_, index) => index + 1).map(
    (step): Shot => ({
      name: `onboarding-${step}`,
      // A placeholder — prepare() below replaces the session with a freshly minted student before
      // this path is ever fetched for real, since the runner's own sign-in happens first.
      path: `/onboarding/${step}`,
      email: 'onboard@example.com',
      prepare: (page) => prepareThroughStep(page, step),
    }),
  ),
];
