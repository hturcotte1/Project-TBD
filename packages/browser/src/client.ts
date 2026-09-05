import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { ACTIVITY_TIMINGS, GRADE_LEVELS } from '@apogee/shared/domain';
import type { Logger } from '@apogee/shared/logging';
import type { CommonAppSnapshot, FillFieldsPayload, FillVerification as FillVerificationSchema } from '@apogee/shared/schemas';
import type { z } from 'zod';
// The exact zod 4.4.3 Stagehand itself depends on — see fallback/stagehand.ts for why.
import { z as z4 } from 'zod-stagehand';
import { COMMONAPP_MAP, resolveCollegePath } from './commonapp-map';
import type { PageExtractorFallback } from './fallback/stagehand';
import { extractActivities } from './extract/activities';
import { extractCollegeQuestions } from './extract/collegeQuestions';
import { extractMyColleges } from './extract/myColleges';
import { detectPageState, type PageState } from './extract/pageState';
import { aggregateSupplementStatus, extractSnapshot, type CapturedPages } from './extract/snapshot';
import { extractWriting } from './extract/writing';
import { SafePage, assertSafeAction } from './guard';
import type { BrowserSessionHandle } from './session/types';

type FillVerificationT = z.infer<typeof FillVerificationSchema>;
type FillFieldT = FillFieldsPayload['fields'][number];

export interface LoginHooks {
  /** Called when the site asks for a verification code. Return null to give up (times out the login). */
  onVerificationCodeRequired: () => Promise<string | null>;
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_credentials' | 'verification_required_timeout' | 'verification_code_rejected' | 'maintenance' | 'unknown'; detail: string };

export interface CaptureHooks {
  onPage?: (name: string, html: string, screenshotPng: Buffer) => Promise<void>;
}

export interface CaptureResult {
  normalized: CommonAppSnapshot;
  raw: Record<string, unknown>;
  lowConfidenceSections: string[];
  pagesVisited: string[];
}

export interface FillResult {
  ok: boolean;
  verifications: FillVerificationT[];
  pagesVisited: string[];
}

export interface CommonAppClient {
  login(session: BrowserSessionHandle, creds: { username: string; secret: string }, hooks: LoginHooks): Promise<LoginResult>;
  isLoggedIn(session: BrowserSessionHandle): Promise<boolean>;
  captureSnapshot(session: BrowserSessionHandle, hooks?: CaptureHooks): Promise<CaptureResult>;
  fillFields(session: BrowserSessionHandle, payload: FillFieldsPayload, hooks?: CaptureHooks): Promise<FillResult>;
}

export interface CreateCommonAppClientOptions {
  baseUrl: string;
  logger: Logger;
  fallback?: PageExtractorFallback | null;
  recordFixtures?: { dir: string } | null;
}

const ORG_PAGES = ['ca_profile', 'ca_family', 'ca_education', 'ca_testing', 'ca_activities', 'ca_writing', 'ca_courses_grades'] as const;
const COLLEGE_PAGES = ['college_questions', 'college_writing_supplement', 'college_recommenders', 'college_review_submit'] as const;

function abs(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function loginErrorDetail(html: string): string {
  const $ = cheerio.load(html);
  const text = $(COMMONAPP_MAP.login.selectors.errorBanner).first().text().trim();
  return text.length > 0 ? text : 'Login was rejected.';
}

function verificationErrorDetail(html: string): string {
  const $ = cheerio.load(html);
  const text = $(COMMONAPP_MAP.verification.selectors.errorBanner).first().text().trim();
  return text.length > 0 ? text : 'The verification code was rejected.';
}

/** Redacts a captured page before it is written to `fixtures/recorded/` (see RECORD_FIXTURES). */
function redactForFixture(html: string, loginUsername: string | null): string {
  const $ = cheerio.load(html);
  $(COMMONAPP_MAP.college_recommenders.selectors.recommenderName).each((_i, el) => {
    $(el).text('[REDACTED NAME]');
  });
  let out = $.html().replace(/value="[^"]*"/g, 'value="[REDACTED]"');
  if (loginUsername && loginUsername.length > 0) out = out.split(loginUsername).join('[REDACTED EMAIL]');
  return out;
}

function toStr(value: FillFieldT['value']): string {
  return String(value);
}

/** The field's value as a string, or undefined if the payload didn't include that key at all. */
function fieldStr(fieldMap: Map<string, FillFieldT>, key: string): string | undefined {
  const f = fieldMap.get(key);
  return f ? toStr(f.value) : undefined;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const LONG_VALUE_CHARS = 200;

/** Replaces a long value (essay prose) with a length + hash fingerprint that still proves what was written. */
export function fingerprintValue(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return `[${words} words, ${value.length} chars, sha256:${createHash('sha256').update(value).digest('hex').slice(0, 12)}]`;
}

export function redactLongVerification(v: FillVerificationT): FillVerificationT {
  const isLong = v.expected.length > LONG_VALUE_CHARS || (v.observed !== null && v.observed.length > LONG_VALUE_CHARS) || /essay/i.test(v.path);
  if (!isLong) return v;
  return { ...v, expected: fingerprintValue(v.expected), observed: v.observed === null ? null : fingerprintValue(v.observed) };
}

export function createCommonAppClient(opts: CreateCommonAppClientOptions): CommonAppClient {
  const { baseUrl, logger, fallback = null, recordFixtures = null } = opts;
  /** creds remembered per session id so a mid-capture session expiry can re-login once, unattended. */
  const lastCreds = new Map<string, { username: string; secret: string }>();

  async function writeFixture(capturedKey: string, html: string, loginUsername: string | null): Promise<void> {
    if (!recordFixtures) return;
    await mkdir(recordFixtures.dir, { recursive: true });
    const filename = `${capturedKey.replace(/[:/]/g, '_')}.html`;
    await writeFile(join(recordFixtures.dir, filename), redactForFixture(html, loginUsername));
  }

  async function doLogin(safePage: SafePage, creds: { username: string; secret: string }, hooks: LoginHooks): Promise<LoginResult> {
    await safePage.goto(abs(baseUrl, COMMONAPP_MAP.login.path));
    await safePage.waitFor(COMMONAPP_MAP.login.waitFor, { timeout: 15_000 }).catch(() => undefined);

    let html = await safePage.content();
    let state = detectPageState(html);
    if (state === 'maintenance') return { ok: false, reason: 'maintenance', detail: 'Common App is showing a maintenance page.' };

    const sel = COMMONAPP_MAP.login.selectors;
    await safePage.fill(sel.emailInput, creds.username);
    await safePage.fill(sel.passwordInput, creds.secret);
    await safePage.check(sel.rememberDeviceCheckbox);
    await safePage.click(sel.submitButton);
    await safePage.waitForLoad();

    html = await safePage.content();
    state = detectPageState(html);

    if (state === 'maintenance') return { ok: false, reason: 'maintenance', detail: 'Common App is showing a maintenance page.' };
    if (state === 'login') return { ok: false, reason: 'invalid_credentials', detail: loginErrorDetail(html) };

    if (state === 'verification') {
      const code = await hooks.onVerificationCodeRequired();
      if (code === null) return { ok: false, reason: 'verification_required_timeout', detail: 'No verification code was provided in time.' };

      const vsel = COMMONAPP_MAP.verification.selectors;
      await safePage.fill(vsel.codeInput, code);
      await safePage.click(vsel.submitButton);
      await safePage.waitForLoad();

      html = await safePage.content();
      state = detectPageState(html);
      if (state === 'maintenance') return { ok: false, reason: 'maintenance', detail: 'Common App is showing a maintenance page.' };
      if (state === 'verification') return { ok: false, reason: 'verification_code_rejected', detail: verificationErrorDetail(html) };
      if (state === 'logged_in') return { ok: true };
      return { ok: false, reason: 'unknown', detail: `Unexpected page state after verification: ${state}` };
    }

    if (state === 'logged_in') return { ok: true };
    return { ok: false, reason: 'unknown', detail: `Unexpected page state after login: ${state}` };
  }

  async function captureSnapshotImpl(session: BrowserSessionHandle, hooks: CaptureHooks): Promise<CaptureResult> {
    const safePage = new SafePage(session.page);
    const pages: CapturedPages = {};
    const pagesVisited: string[] = [];
    let reloginAttempted = false;
    const loginUsername = lastCreds.get(session.id)?.username ?? null;

    async function visit(key: string, url: string, waitFor: string): Promise<string> {
      await safePage.goto(url);
      await safePage.waitFor(waitFor, { timeout: 15_000 }).catch(() => undefined);
      const html = await safePage.content();
      const state: PageState = detectPageState(html);

      if (state === 'maintenance') {
        throw new Error(`captureSnapshot: Common App is showing a maintenance page while visiting "${key}"`);
      }
      if (state === 'login') {
        if (reloginAttempted) {
          throw new Error(`captureSnapshot: session expired while visiting "${key}" and the re-login attempt also failed`);
        }
        reloginAttempted = true;
        const creds = lastCreds.get(session.id);
        if (!creds) {
          throw new Error(`captureSnapshot: session expired while visiting "${key}" and no credentials are on hand to re-login`);
        }
        logger.warn({ key }, 'captureSnapshot: session expired mid-capture, attempting one re-login');
        const result = await doLogin(safePage, creds, { onVerificationCodeRequired: async () => null });
        if (!result.ok) {
          throw new Error(`captureSnapshot: re-login after session expiry failed (${result.reason}): ${result.detail}`);
        }
        return visit(key, url, waitFor);
      }

      const screenshot = await safePage.screenshot();
      await hooks.onPage?.(key, html, screenshot);
      await writeFixture(key, html, loginUsername);
      pages[key] = html;
      pagesVisited.push(key);
      return html;
    }

    await visit('dashboard', abs(baseUrl, COMMONAPP_MAP.dashboard.path), COMMONAPP_MAP.dashboard.waitFor);
    const myCollegesHtml = await visit('my_colleges', abs(baseUrl, COMMONAPP_MAP.my_colleges.path), COMMONAPP_MAP.my_colleges.waitFor);

    for (const pageName of ORG_PAGES) {
      const def = COMMONAPP_MAP[pageName];
      await visit(pageName, abs(baseUrl, def.path), def.waitFor);
    }

    const collegeRows = extractMyColleges(myCollegesHtml).value;
    for (const row of collegeRows) {
      for (const pageName of COLLEGE_PAGES) {
        const def = COMMONAPP_MAP[pageName];
        const url = abs(baseUrl, resolveCollegePath(def, row.common_app_college_id));
        await visit(`${pageName}:${row.common_app_college_id}`, url, def.waitFor);
      }
    }

    const capturedAt = new Date().toISOString();
    const snapshotResult = extractSnapshot(pages, capturedAt);

    if (fallback) {
      await mergeFallback(snapshotResult, session, fallback, logger);
    }

    return { ...snapshotResult, pagesVisited };
  }

  async function fillActivities(safePage: SafePage, fields: FillFieldT[], hooks: CaptureHooks): Promise<{ verifications: FillVerificationT[]; pagesVisited: string[] }> {
    const pagesVisited: string[] = [];
    const groups = new Map<number, Map<string, FillFieldT>>();
    for (const f of fields) {
      const m = /^activities\[(\d+)]\.(.+)$/.exec(f.path);
      if (!m) throw new Error(`fillFields activities: unrecognized field path "${f.path}"`);
      const idx = Number(m[1]);
      const key = m[2] as string;
      if (!groups.has(idx)) groups.set(idx, new Map());
      groups.get(idx)?.set(key, f);
    }

    const listUrl = abs(baseUrl, COMMONAPP_MAP.ca_activities.path);
    await safePage.goto(listUrl);
    await safePage.waitFor(COMMONAPP_MAP.ca_activities.waitFor);
    pagesVisited.push('ca_activities');
    const before = extractActivities(await safePage.content()).value;
    const sel = COMMONAPP_MAP.ca_activities.selectors;

    for (const idx of [...groups.keys()].sort((a, b) => a - b)) {
      const fieldMap = groups.get(idx) as Map<string, FillFieldT>;
      const existing = before[idx];
      const activityTypeField = fieldStr(fieldMap, 'activity_type');
      const positionField = fieldStr(fieldMap, 'position');
      const organizationField = fieldStr(fieldMap, 'organization');
      const descriptionField = fieldStr(fieldMap, 'description');
      const gradeLevelsField = fieldStr(fieldMap, 'grade_levels');
      const timingField = fieldStr(fieldMap, 'timing');
      const hoursField = fieldStr(fieldMap, 'hours_per_week');
      const weeksField = fieldStr(fieldMap, 'weeks_per_year');
      const continueField = fieldStr(fieldMap, 'continue_in_college');
      const target = {
        activity_type: activityTypeField ?? existing?.activity_type ?? 'other',
        position: positionField ?? existing?.position ?? '',
        organization: organizationField ?? existing?.organization ?? '',
        description: descriptionField ?? existing?.description ?? '',
        grade_levels: gradeLevelsField !== undefined ? splitCsv(gradeLevelsField) : (existing?.grade_levels ?? []),
        timing: timingField !== undefined ? splitCsv(timingField) : (existing?.timing ?? []),
        hours_per_week: hoursField !== undefined ? Number(hoursField) : (existing?.hours_per_week ?? 0),
        weeks_per_year: weeksField !== undefined ? Number(weeksField) : (existing?.weeks_per_year ?? 1),
        continue_in_college: continueField !== undefined ? continueField.trim().toLowerCase() === 'true' : (existing?.continue_in_college ?? false),
      };

      await safePage.goto(`${listUrl}?edit=${idx}`);
      await safePage.waitFor(COMMONAPP_MAP.ca_activities.waitFor);
      await safePage.selectOption(sel.formTypeSelect, target.activity_type);
      await safePage.fill(sel.formPositionInput, target.position);
      await safePage.fill(sel.formOrganizationInput, target.organization);
      await safePage.fill(sel.formDescriptionInput, target.description);
      for (const g of GRADE_LEVELS) {
        const checkbox = `${sel.formGradeLevelCheckbox}[value="${g}"]`;
        if (target.grade_levels.includes(g)) await safePage.check(checkbox);
        else await safePage.uncheck(checkbox);
      }
      for (const t of ACTIVITY_TIMINGS) {
        const checkbox = `${sel.formTimingCheckbox}[value="${t}"]`;
        if (target.timing.includes(t)) await safePage.check(checkbox);
        else await safePage.uncheck(checkbox);
      }
      await safePage.fill(sel.formHoursInput, String(target.hours_per_week));
      await safePage.fill(sel.formWeeksInput, String(target.weeks_per_year));
      if (target.continue_in_college) await safePage.check(sel.formContinueCheckbox);
      else await safePage.uncheck(sel.formContinueCheckbox);
      await safePage.click(sel.formSaveButton);
      await safePage.waitForLoad();
    }

    await safePage.goto(listUrl);
    await safePage.waitFor(COMMONAPP_MAP.ca_activities.waitFor);
    const afterHtml = await safePage.content();
    await hooks.onPage?.('ca_activities', afterHtml, await safePage.screenshot());
    const after = extractActivities(afterHtml).value;

    const verifications: FillVerificationT[] = [];
    for (const [idx, fieldMap] of groups) {
      const row = after[idx];
      for (const [key, field] of fieldMap) {
        const expected = toStr(field.value);
        let observed: string | null = null;
        if (row) {
          if (key === 'grade_levels') observed = row.grade_levels.join(',');
          else if (key === 'timing') observed = row.timing.join(',');
          else if (key === 'hours_per_week') observed = row.hours_per_week === null ? null : String(row.hours_per_week);
          else if (key === 'weeks_per_year') observed = row.weeks_per_year === null ? null : String(row.weeks_per_year);
          else if (key === 'continue_in_college') observed = String(row.continue_in_college);
          else if (key === 'activity_type') observed = row.activity_type;
          else if (key === 'position') observed = row.position;
          else if (key === 'organization') observed = row.organization;
          else if (key === 'description') observed = row.description;
        }
        verifications.push({ path: field.path, expected, observed, matched: observed === expected });
      }
    }
    return { verifications, pagesVisited };
  }

  async function fillProfile(safePage: SafePage, fields: FillFieldT[], hooks: CaptureHooks): Promise<{ verifications: FillVerificationT[]; pagesVisited: string[] }> {
    const pagesVisited: string[] = [];
    const verifications: FillVerificationT[] = [];
    const profileFields = fields.filter((f) => f.path.startsWith('profile.'));
    const educationFields = fields.filter((f) => f.path.startsWith('education.'));
    const other = fields.filter((f) => !f.path.startsWith('profile.') && !f.path.startsWith('education.'));
    if (other.length > 0) throw new Error(`fillFields profile: unrecognized field path(s): ${other.map((f) => f.path).join(', ')}`);

    if (profileFields.length > 0) {
      const url = abs(baseUrl, COMMONAPP_MAP.ca_profile.path);
      const sel = COMMONAPP_MAP.ca_profile.selectors;
      const inputFor: Record<string, string> = { first_name: sel.firstNameInput, last_name: sel.lastNameInput, preferred_name: sel.preferredNameInput };
      await safePage.goto(url);
      await safePage.waitFor(COMMONAPP_MAP.ca_profile.waitFor);
      pagesVisited.push('ca_profile');
      for (const f of profileFields) {
        const key = f.path.slice('profile.'.length);
        const input = inputFor[key];
        if (!input) throw new Error(`fillFields profile: unknown field "${key}"`);
        await safePage.fill(input, toStr(f.value));
      }
      await safePage.click(sel.saveButton);
      await safePage.waitForLoad();

      const html = await safePage.content();
      await hooks.onPage?.('ca_profile', html, await safePage.screenshot());
      const $ = cheerio.load(html);
      for (const f of profileFields) {
        const key = f.path.slice('profile.'.length);
        const expected = toStr(f.value);
        const observed = $(inputFor[key] as string).attr('value') ?? null;
        verifications.push({ path: f.path, expected, observed, matched: observed === expected });
      }
    }

    if (educationFields.length > 0) {
      const url = abs(baseUrl, COMMONAPP_MAP.ca_education.path);
      const sel = COMMONAPP_MAP.ca_education.selectors;
      const inputFor: Record<string, string> = {
        high_school: sel.highSchoolInput,
        graduation_year: sel.graduationYearInput,
        gpa_unweighted: sel.gpaUnweightedInput,
        gpa_weighted: sel.gpaWeightedInput,
        class_rank: sel.classRankInput,
      };
      await safePage.goto(url);
      await safePage.waitFor(COMMONAPP_MAP.ca_education.waitFor);
      pagesVisited.push('ca_education');
      for (const f of educationFields) {
        const key = f.path.slice('education.'.length);
        const input = inputFor[key];
        if (!input) throw new Error(`fillFields profile: unknown education field "${key}"`);
        await safePage.fill(input, toStr(f.value));
      }
      await safePage.click(sel.saveButton);
      await safePage.waitForLoad();

      const html = await safePage.content();
      await hooks.onPage?.('ca_education', html, await safePage.screenshot());
      const $ = cheerio.load(html);
      for (const f of educationFields) {
        const key = f.path.slice('education.'.length);
        const expected = toStr(f.value);
        const observed = $(inputFor[key] as string).attr('value') ?? null;
        verifications.push({ path: f.path, expected, observed, matched: observed === expected });
      }
    }

    return { verifications, pagesVisited };
  }

  async function fillPersonalEssay(safePage: SafePage, fields: FillFieldT[], hooks: CaptureHooks): Promise<{ verifications: FillVerificationT[]; pagesVisited: string[] }> {
    const url = abs(baseUrl, COMMONAPP_MAP.ca_writing.path);
    const sel = COMMONAPP_MAP.ca_writing.selectors;
    await safePage.goto(url);
    await safePage.waitFor(COMMONAPP_MAP.ca_writing.waitFor);

    for (const f of fields) {
      const key = f.path.startsWith('writing.') ? f.path.slice('writing.'.length) : f.path;
      if (key === 'personal_essay') await safePage.fill(sel.essayTextarea, toStr(f.value));
      else if (key === 'prompt_index') await safePage.selectOption(sel.promptIndexSelect, toStr(f.value));
      else throw new Error(`fillFields personal_essay: unknown field "${key}"`);
    }
    await safePage.click(sel.saveButton);
    await safePage.waitForLoad();

    const writingHtml = await safePage.content();
    await hooks.onPage?.('ca_writing', writingHtml, await safePage.screenshot());
    const observed = extractWriting(writingHtml).value;
    const verifications: FillVerificationT[] = fields.map((f) => {
      const key = f.path.startsWith('writing.') ? f.path.slice('writing.'.length) : f.path;
      const expected = toStr(f.value);
      const observedVal = key === 'personal_essay' ? observed.essayText : key === 'prompt_index' ? (observed.promptIndex === null ? null : String(observed.promptIndex)) : null;
      return { path: f.path, expected, observed: observedVal, matched: observedVal === expected };
    });
    return { verifications, pagesVisited: ['ca_writing'] };
  }

  async function fillCollegeQuestions(safePage: SafePage, schoolSlug: string | null, fields: FillFieldT[], hooks: CaptureHooks): Promise<{ verifications: FillVerificationT[]; pagesVisited: string[] }> {
    if (!schoolSlug) throw new Error('fillFields college_questions requires a school_slug');
    const def = COMMONAPP_MAP.college_questions;
    const url = abs(baseUrl, resolveCollegePath(def, schoolSlug));
    const sel = def.selectors;
    const inputFor: Record<string, string> = { q_intended_major: sel.intendedMajorSelect, q_additional_info: sel.additionalInfoTextarea };

    await safePage.goto(url);
    await safePage.waitFor(def.waitFor);
    for (const f of fields) {
      const key = f.path.startsWith('questions.') ? f.path.slice('questions.'.length) : f.path;
      const input = inputFor[key];
      if (!input) throw new Error(`fillFields college_questions: unknown field "${key}"`);
      if (key === 'q_intended_major') await safePage.selectOption(input, toStr(f.value));
      else await safePage.fill(input, toStr(f.value));
    }
    await safePage.click(sel.saveButton);
    await safePage.waitForLoad();

    const questionsHtml = await safePage.content();
    await hooks.onPage?.(`college_questions:${schoolSlug}`, questionsHtml, await safePage.screenshot());
    const observed = extractCollegeQuestions(questionsHtml).value.answers;
    const verifications: FillVerificationT[] = fields.map((f) => {
      const key = f.path.startsWith('questions.') ? f.path.slice('questions.'.length) : f.path;
      const expected = toStr(f.value);
      const observedVal = key === 'q_intended_major' ? observed.q_intended_major : key === 'q_additional_info' ? observed.q_additional_info : null;
      return { path: f.path, expected, observed: observedVal, matched: observedVal === expected };
    });
    return { verifications, pagesVisited: [`college_questions:${schoolSlug}`] };
  }

  return {
    async login(session, creds, hooks) {
      const safePage = new SafePage(session.page);
      const result = await doLogin(safePage, creds, hooks);
      if (result.ok) lastCreds.set(session.id, creds);
      return result;
    },

    async isLoggedIn(session) {
      const safePage = new SafePage(session.page);
      const html = await safePage.content();
      return detectPageState(html) === 'logged_in';
    },

    async captureSnapshot(session, hooks = {}) {
      return captureSnapshotImpl(session, hooks);
    },

    async fillFields(session, payload, hooks = {}) {
      // Defense in depth, independent of every field's destination page: never act on anything
      // whose own path/label reads like a submit/payment/order-confirmation action (see guard.ts).
      for (const field of payload.fields) {
        assertSafeAction({ selector: field.path, text: field.label });
      }

      const safePage = new SafePage(session.page);
      let result: { verifications: FillVerificationT[]; pagesVisited: string[] };
      switch (payload.section) {
        case 'activities':
          result = await fillActivities(safePage, payload.fields, hooks);
          break;
        case 'profile':
          result = await fillProfile(safePage, payload.fields, hooks);
          break;
        case 'personal_essay':
          result = await fillPersonalEssay(safePage, payload.fields, hooks);
          break;
        case 'college_questions':
          result = await fillCollegeQuestions(safePage, payload.school_slug, payload.fields, hooks);
          break;
      }
      // Long values (essay text) are never persisted: audit rows and API responses get a fingerprint.
      result = { ...result, verifications: result.verifications.map(redactLongVerification) };
      return { ok: result.verifications.every((v) => v.matched), verifications: result.verifications, pagesVisited: result.pagesVisited };
    },
  };
}

// ---- Stagehand fallback merge (only reached when `fallback` is configured) ----

const statusEnum4 = z4.enum(['complete', 'in_progress', 'not_started', 'unknown']);
const sectionsSchema4 = z4.object({
  profile: statusEnum4,
  family: statusEnum4,
  education: statusEnum4,
  testing: statusEnum4,
  activities: statusEnum4,
  activities_count: z4.number().int().nullable(),
  writing: z4.object({ status: statusEnum4, prompt_index: z4.number().int().nullable(), word_count: z4.number().int().nullable() }),
  courses_grades: statusEnum4,
});
const testingSchema4 = z4.object({
  self_reported: z4.array(z4.object({ test: z4.string(), score: z4.string(), date: z4.string().nullable() })),
  scores_sent_indicators: z4.array(z4.string()),
});
const questionsSchema4 = z4.object({ status: statusEnum4 });
const recommenderEntry4 = z4.object({
  name: z4.string(),
  role: z4.enum(['teacher', 'counselor', 'other']),
  status: z4.enum(['not_invited', 'invited', 'submitted', 'declined', 'unknown']),
  invited_at: z4.string().nullable(),
  submitted_at: z4.string().nullable(),
  subject: z4.string().nullable(),
});
const supplementsSchema4 = z4.object({
  supplements: z4.array(z4.object({ title: z4.string(), required: z4.boolean().nullable(), status: statusEnum4, word_count: z4.number().int().nullable() })),
});
const recommendersSchema4 = z4.object({
  ferpa_status: z4.enum(['complete', 'incomplete', 'unknown']),
  counselor: recommenderEntry4.nullable(),
  teachers: z4.array(recommenderEntry4),
  others: z4.array(recommenderEntry4),
});
const reviewSubmitSchema4 = z4.object({
  review_submit_status: z4.enum(['not_ready', 'ready', 'submitted', 'unknown']),
  fee_status: z4.enum(['unpaid', 'paid', 'waived', 'not_required', 'unknown']),
  submission_status: z4.enum(['not_submitted', 'submitted', 'unknown']),
  submitted_at: z4.string().nullable(),
});

/**
 * Asks the Stagehand fallback to re-read every low-confidence section and, when it reports higher
 * confidence than the deterministic extractor did, splices its value into `snapshotResult` in
 * place. `my_colleges` and `dashboard` are deliberately not auto-recovered: a low-confidence
 * college *list* can't be safely reconciled field-by-field the way a single college's status can,
 * so those stay low-confidence and flagged for a human (site_drift_alerts, at the app layer).
 */
async function mergeFallback(
  snapshotResult: { normalized: CommonAppSnapshot; lowConfidenceSections: string[] },
  session: BrowserSessionHandle,
  fallback: PageExtractorFallback,
  logger: Logger,
): Promise<void> {
  const snap = snapshotResult.normalized;
  for (const key of [...snap.low_confidence_sections]) {
    try {
      if (key === 'sections') {
        const r = await fallback.extractSection(key, 'Read the status (complete/in_progress/not_started) of every Common App tab: Profile, Family, Education, Testing, Activities (and how many activities are entered), Writing (status, which prompt number, word count), and Courses & Grades. Do not click or fill anything.', sectionsSchema4, session);
        if (r.confidence > (snap.confidence.sections ?? 0)) {
          snap.sections = r.value;
          snap.confidence.sections = r.confidence;
        }
      } else if (key === 'testing') {
        const r = await fallback.extractSection(key, 'Read every self-reported test score row on the Testing tab (test name, score, date). Do not click or fill anything.', testingSchema4, session);
        if (r.confidence > (snap.confidence.testing ?? 0)) {
          snap.testing = r.value;
          snap.confidence.testing = r.confidence;
        }
      } else if (key.startsWith('college:')) {
        const [, collegeId, sub] = key.split(':');
        const college = snap.colleges.find((c) => c.common_app_college_id === collegeId);
        if (!college) continue;
        if (sub === 'questions') {
          const r = await fallback.extractSection(key, 'Read this college\'s Questions tab completion status (complete/in_progress/not_started). Do not click or fill anything.', questionsSchema4, session);
          if (r.confidence > (snap.confidence[key] ?? 0)) {
            college.questions_status = r.value.status;
            snap.confidence[key] = r.confidence;
          }
        } else if (sub === 'supplements') {
          const r = await fallback.extractSection(key, "Read every writing supplement prompt on this college's Writing Supplement tab: title, whether it is required, its status, and its word count. Do not click or fill anything.", supplementsSchema4, session);
          if (r.confidence > (snap.confidence[key] ?? 0)) {
            college.supplements = r.value.supplements;
            college.writing_supplement_status = aggregateSupplementStatus(r.value.supplements.map((s) => ({ title: s.title, required: s.required, status: s.status, word_count: s.word_count })));
            snap.confidence[key] = r.confidence;
          }
        } else if (sub === 'recommenders') {
          const r = await fallback.extractSection(key, "Read this college's Recommenders tab: the FERPA release status, and every counselor/teacher/other recommender's name, status, invited date, and submitted date. Do not click or fill anything.", recommendersSchema4, session);
          if (r.confidence > (snap.confidence[key] ?? 0)) {
            college.ferpa_status = r.value.ferpa_status;
            college.counselor = r.value.counselor;
            college.teachers = r.value.teachers;
            college.others = r.value.others;
            snap.confidence[key] = r.confidence;
          }
        } else if (sub === 'review_submit') {
          const r = await fallback.extractSection(key, "Read this college's completion status, the application cost status (unpaid, paid, or waived), and whether it has been submitted. Do not click or fill anything, and never interact with any button on this page.", reviewSubmitSchema4, session);
          if (r.confidence > (snap.confidence[key] ?? 0)) {
            college.review_submit_status = r.value.review_submit_status;
            college.fee_status = r.value.fee_status;
            college.submission_status = r.value.submission_status;
            college.submitted_at = r.value.submitted_at;
            snap.confidence[key] = r.confidence;
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err), key }, 'stagehand fallback failed for low-confidence section');
    }
  }
  snap.low_confidence_sections = Object.entries(snap.confidence)
    .filter(([, c]) => c < 0.5)
    .map(([k]) => k);
  snapshotResult.lowConfidenceSections = snap.low_confidence_sections;
}
