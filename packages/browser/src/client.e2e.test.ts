import type { FillFieldsPayload } from '@tbd/shared/schemas';
import { createLogger } from '@tbd/shared/logging';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COMMONAPP_MAP, resolveCollegePath } from './commonapp-map';
import { createCommonAppClient } from './client';
import { SafePage, SubmitGuardError } from './guard';
import { defaultMockState, startMockCommonApp, type MockCommonAppHandle } from './mock/index';
import { LocalChromiumSessionProvider } from './session/local';
import type { BrowserSessionHandle } from './session/types';

/**
 * Real headless Chromium against the mock Common App site on a random port. Requires
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to be set in this sandbox (Playwright's bundled Chromium
 * revision is absent) — see the package report.
 */
describe('CommonAppClient e2e (real headless Chromium, mock site)', () => {
  let mock: MockCommonAppHandle;
  let provider: LocalChromiumSessionProvider;
  let client: ReturnType<typeof createCommonAppClient>;
  const openSessions: BrowserSessionHandle[] = [];

  beforeAll(async () => {
    mock = await startMockCommonApp({ port: 0 });
    provider = new LocalChromiumSessionProvider({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
    client = createCommonAppClient({ baseUrl: mock.url, logger: createLogger({ name: 'client.e2e.test' }) });
  });

  afterEach(async () => {
    for (const s of openSessions.splice(0)) await s.close().catch(() => undefined);
    mock.reset();
  });

  afterAll(async () => {
    await mock.close();
  });

  async function openSession(): Promise<BrowserSessionHandle> {
    const session = await provider.open({ studentId: 'demo' });
    openSessions.push(session);
    return session;
  }

  it('rejects an incorrect password', async () => {
    const session = await openSession();
    const result = await client.login(session, { username: 'demo@example.com', secret: 'not-the-password' }, { onVerificationCodeRequired: async () => null });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_credentials' });
    if (!result.ok) expect(result.detail.length).toBeGreaterThan(0);
  });

  it('logs in with the correct password and no verification code configured', async () => {
    const session = await openSession();
    const result = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(result).toEqual({ ok: true });
    expect(await client.isLoggedIn(session)).toBe(true);
  });

  it('shows a maintenance page instead of logging in when the site is down', async () => {
    const state = defaultMockState();
    state.maintenance = true;
    mock.setState(state);
    const session = await openSession();
    const result = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(result).toMatchObject({ ok: false, reason: 'maintenance' });
  });

  describe('verification code', () => {
    beforeEach(() => {
      const state = defaultMockState();
      state.account.verificationCode = '482913';
      mock.setState(state);
    });

    it('logs in when the hook supplies the correct code, and remembers the device for the next login', async () => {
      const session = await openSession();
      const first = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => '482913' });
      expect(first).toEqual({ ok: true });

      // Same session (same cookies) logging in again: a hook that would fail is never reached
      // because the "remember this device" cookie skips the verification step entirely.
      const second = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
      expect(second).toEqual({ ok: true });
    });

    it('times out when the hook returns null', async () => {
      const session = await openSession();
      const result = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
      expect(result).toMatchObject({ ok: false, reason: 'verification_required_timeout' });
    });

    it('rejects a wrong code', async () => {
      const session = await openSession();
      const result = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => '000000' });
      expect(result).toMatchObject({ ok: false, reason: 'verification_code_rejected' });
    });
  });

  it('captureSnapshot visits every page, screenshots each one, and matches the demo student state', async () => {
    const session = await openSession();
    const login = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(login).toEqual({ ok: true });

    const pages: Array<{ name: string; html: string; png: Buffer }> = [];
    const result = await client.captureSnapshot(session, { onPage: async (name, html, png) => void pages.push({ name, html, png }) });

    // dashboard + my_colleges + 7 Common App tabs + 11 colleges * 4 per-college pages
    expect(result.pagesVisited).toHaveLength(2 + 7 + 11 * 4);
    expect(pages).toHaveLength(result.pagesVisited.length);
    for (const p of pages) {
      expect(p.png.length, `screenshot for "${p.name}"`).toBeGreaterThan(1024);
      expect(p.html.length).toBeGreaterThan(0);
    }

    expect(result.lowConfidenceSections).toEqual([]);
    expect(result.normalized.colleges).toHaveLength(11);
    expect(result.normalized.colleges.map((c) => c.name)).not.toContain('Georgetown University');

    const umich = result.normalized.colleges.find((c) => c.name === 'University of Michigan');
    expect(umich).toMatchObject({ plan: 'EA', deadline: '2026-11-01', questions_status: 'in_progress', ferpa_status: 'complete', fee_status: 'unpaid' });
    expect(umich?.supplements).toEqual([
      { title: 'Community essay', required: true, status: 'complete', word_count: 298 },
      { title: 'Why Michigan', required: true, status: 'in_progress', word_count: 143 },
    ]);
    expect(umich?.teachers.map((t) => `${t.name}:${t.status}`).sort()).toEqual(['Mr. Okafor:submitted', 'Ms. Park:invited']);

    expect(result.normalized.sections).toMatchObject({
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      courses_grades: 'not_started',
    });
    expect(result.normalized.sections.writing).toEqual({ status: 'in_progress', prompt_index: 5, word_count: 412 });
    expect(result.normalized.testing.self_reported).toEqual([{ test: 'SAT', score: '1450', date: '2026-06-06' }]);
  });

  it('fillFields activities: adds the two profile-only activities as entries 7 and 8', async () => {
    const session = await openSession();
    const login = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(login).toEqual({ ok: true });

    function activityFields(idx: number, a: { activity_type: string; position: string; organization: string; description: string; grade_levels: string; timing: string; hours_per_week: number; weeks_per_year: number; continue_in_college: boolean }): FillFieldsPayload['fields'] {
      const p = `activities[${idx}]`;
      return [
        { path: `${p}.activity_type`, label: `Activity ${idx + 1} type`, value: a.activity_type },
        { path: `${p}.position`, label: `Activity ${idx + 1} position`, value: a.position },
        { path: `${p}.organization`, label: `Activity ${idx + 1} organization`, value: a.organization },
        { path: `${p}.description`, label: `Activity ${idx + 1} description`, value: a.description },
        { path: `${p}.grade_levels`, label: `Activity ${idx + 1} grades`, value: a.grade_levels },
        { path: `${p}.timing`, label: `Activity ${idx + 1} timing`, value: a.timing },
        { path: `${p}.hours_per_week`, label: `Activity ${idx + 1} hours/week`, value: a.hours_per_week },
        { path: `${p}.weeks_per_year`, label: `Activity ${idx + 1} weeks/year`, value: a.weeks_per_year },
        { path: `${p}.continue_in_college`, label: `Activity ${idx + 1} continue in college`, value: a.continue_in_college },
      ];
    }

    const research = {
      activity_type: 'research',
      position: 'Research Assistant',
      organization: 'UIC Chemistry Lab',
      description: 'Summer research assistant; ran titration experiments and logged data for a water-quality project.',
      grade_levels: '11',
      timing: 'school_break',
      hours_per_week: 20,
      weeks_per_year: 8,
      continue_in_college: false,
    };
    const studentGovernment = {
      activity_type: 'student_government',
      position: 'Class Treasurer',
      organization: 'Junior Class Student Government',
      description: 'Elected treasurer for the junior class; manage the fundraising budget and track event finances.',
      grade_levels: '11',
      timing: 'school_year',
      hours_per_week: 2,
      weeks_per_year: 30,
      continue_in_college: true,
    };

    const payload: FillFieldsPayload = {
      kind: 'fill_fields',
      section: 'activities',
      school_slug: null,
      fields: [...activityFields(6, research), ...activityFields(7, studentGovernment)],
      origin: 'student_profile',
    };

    const result = await client.fillFields(session, payload);
    expect(result.ok).toBe(true);
    expect(result.verifications).toHaveLength(18);
    for (const v of result.verifications) expect(v.matched, `${v.path}: expected "${v.expected}", observed "${v.observed}"`).toBe(true);

    const state = mock.getState();
    expect(state.activities).toHaveLength(8);
    expect(state.activities[6]).toMatchObject({ activity_type: 'research', position: 'Research Assistant', organization: 'UIC Chemistry Lab' });
    expect(state.activities[7]).toMatchObject({ activity_type: 'student_government', position: 'Class Treasurer' });
  });

  it('fillFields refuses a payload whose field targets a submit/review action, even in an unrelated section', async () => {
    const session = await openSession();
    const login = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(login).toEqual({ ok: true });

    const payload: FillFieldsPayload = {
      kind: 'fill_fields',
      section: 'college_questions',
      school_slug: 'umich',
      fields: [{ path: 'review_submit.confirm', label: 'Submit application', value: true }],
      origin: 'dashboard_editor',
    };

    await expect(client.fillFields(session, payload)).rejects.toThrow(SubmitGuardError);
    // Nothing changed: the guard fired before any navigation away from the dashboard.
    const college = mock.getState().colleges.find((c) => c.slug === 'umich');
    expect(college?.reviewSubmitStatus).toBe('not_ready');
  });

  it('the mock review-and-completion page really has a submit button, and SafePage refuses to click it', async () => {
    const session = await openSession();
    const login = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(login).toEqual({ ok: true });

    const def = COMMONAPP_MAP.college_review_submit;
    const safePage = new SafePage(session.page);
    // Reading the page (including its submit button's existence) is fine — only guard.ts blocks acting on it.
    await safePage.goto(`${mock.url}${resolveCollegePath(def, 'umich')}`);
    await safePage.waitFor(def.waitFor);
    await expect(safePage.locator(def.selectors.submitApplicationButton).count()).resolves.toBe(1);

    await expect(safePage.click(def.selectors.submitApplicationButton)).rejects.toThrow(SubmitGuardError);

    // Posting to that route is also a safe no-op server-side (see the mock's route notes), but the
    // guard means this package's own code can never reach it by clicking.
    const college = mock.getState().colleges.find((c) => c.slug === 'umich');
    expect(college?.submissionStatus).toBe('not_submitted');
  });

  it('recovers from a session expiry by re-logging in once with the stored credentials, then succeeds', async () => {
    const session = await openSession();
    const login = await client.login(session, { username: 'demo@example.com', secret: 'demo-password' }, { onVerificationCodeRequired: async () => null });
    expect(login).toEqual({ ok: true });

    // Invalidate the session server-side, as if it had expired mid-crawl.
    const res = await fetch(`${mock.url}/__logout`, { method: 'POST' });
    expect(res.ok).toBe(true);

    const result = await client.captureSnapshot(session);
    expect(result.pagesVisited).toHaveLength(2 + 7 + 11 * 4);
    expect(result.normalized.colleges).toHaveLength(11);
  });
});
