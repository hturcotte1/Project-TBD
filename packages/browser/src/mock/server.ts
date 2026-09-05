import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import type { Logger } from '@apogee/shared/logging';
import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, GRADE_LEVELS } from '@apogee/shared/domain';
import { COMMONAPP_MAP, PER_COLLEGE_PAGES, type PageName } from '../commonapp-map';
import { MockActivityEntry, type MockAccountState, type MockCollege } from './state';
import {
  activitiesPage,
  collegeQuestionsPage,
  collegeRecommendersPage,
  collegeReviewSubmitPage,
  collegeWritingSupplementPage,
  coursesGradesPage,
  countWords,
  dashboardPage,
  educationPage,
  familyPage,
  loginPage,
  maintenancePage,
  myCollegesPage,
  notFoundPage,
  profilePage,
  testingPage,
  verificationPage,
  writingPage,
} from './render';
import { defaultMockState } from './state';

const SESSION_COOKIE = 'capp_session';
const PENDING_COOKIE = 'capp_pending';
const REMEMBER_COOKIE = 'capp_remember';

/** Converts a `commonapp-map.ts` path (`:collegeId`) into a Fastify route path (`:id`). */
function toFastifyPath(mapPath: string): string {
  return mapPath.replace(':collegeId', ':id');
}

function toArray(v: unknown): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function toStr(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return v === undefined ? '' : String(v);
}

function toNum(v: unknown, fallback: number): number {
  const s = toStr(v);
  if (s === '') return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export interface StartMockCommonAppOptions {
  port: number;
  state?: MockAccountState;
  logger?: Logger;
}

export interface MockCommonAppHandle {
  url: string;
  port: number;
  getState(): MockAccountState;
  setState(next: MockAccountState): void;
  reset(): void;
  close(): Promise<void>;
}

/** Starts the mock Common App as a standalone Fastify server. See `docs/DEMO_STUDENT.md`. */
export async function startMockCommonApp(opts: StartMockCommonAppOptions): Promise<MockCommonAppHandle> {
  let state: MockAccountState = opts.state ?? defaultMockState();
  let sessionEpoch = 0;
  const logger = opts.logger;

  const app: FastifyInstance = Fastify({ logger: false });
  await app.register(fastifyFormbody);
  await app.register(fastifyCookie);

  function findCollege(id: string): MockCollege | undefined {
    return state.colleges.find((c) => c.slug === id);
  }

  function isAuthenticated(req: FastifyRequest): boolean {
    const token = req.cookies[SESSION_COOKIE];
    return token !== undefined && token === String(sessionEpoch);
  }

  function setSessionCookie(reply: FastifyReply): void {
    reply.setCookie(SESSION_COOKIE, String(sessionEpoch), { path: '/', httpOnly: true });
  }

  function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
    if (isAuthenticated(req)) return true;
    reply.redirect('/account/login');
    return false;
  }

  // Maintenance takes over every non-admin route, any method.
  app.addHook('onRequest', async (req, reply) => {
    if (state.maintenance && !req.url.startsWith('/__')) {
      reply.type('text/html').code(503).send(maintenancePage());
    }
  });

  // ---- Auth ----
  app.get('/account/login', async (_req, reply) => {
    reply.type('text/html').send(loginPage());
  });

  app.post('/account/login', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const email = toStr(body.email);
    const password = toStr(body.password);
    const rememberRequested = toArray(body.remember_device).length > 0;

    if (email !== state.account.email || password !== state.account.password) {
      reply.type('text/html').code(200).send(loginPage({ error: 'Incorrect email or password. Please try again.' }));
      return;
    }

    const deviceRemembered = req.cookies[REMEMBER_COOKIE] === '1';
    if (state.account.verificationCode !== null && !deviceRemembered) {
      reply.setCookie(PENDING_COOKIE, rememberRequested ? 'remember' : 'plain', { path: '/', httpOnly: true });
      reply.redirect('/account/verify');
      return;
    }

    setSessionCookie(reply);
    if (rememberRequested) reply.setCookie(REMEMBER_COOKIE, '1', { path: '/', httpOnly: true });
    reply.redirect('/dashboard');
  });

  app.get('/account/verify', async (req, reply) => {
    if (req.cookies[PENDING_COOKIE] === undefined) {
      reply.redirect('/account/login');
      return;
    }
    reply.type('text/html').send(verificationPage());
  });

  app.post('/account/verify', async (req, reply) => {
    const pending = req.cookies[PENDING_COOKIE];
    if (pending === undefined) {
      reply.redirect('/account/login');
      return;
    }
    const body = req.body as Record<string, unknown>;
    const code = toStr(body.code);
    if (code !== state.account.verificationCode) {
      reply.type('text/html').code(200).send(verificationPage({ error: "That code didn't match. Please check your email and try again." }));
      return;
    }
    reply.clearCookie(PENDING_COOKIE, { path: '/' });
    setSessionCookie(reply);
    if (pending === 'remember') reply.setCookie(REMEMBER_COOKIE, '1', { path: '/', httpOnly: true });
    reply.redirect('/dashboard');
  });

  app.post('/account/logout', async (_req, reply) => {
    sessionEpoch += 1;
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.redirect('/account/login');
  });

  // ---- Authenticated pages ----
  app.get('/dashboard', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(dashboardPage(state));
  });

  app.get('/my-colleges', async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(myCollegesPage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_profile.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(profilePage(state));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.ca_profile.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as Record<string, unknown>;
    state.profile.firstName = toStr(body.first_name) || state.profile.firstName;
    state.profile.lastName = toStr(body.last_name) || state.profile.lastName;
    state.profile.preferredName = toStr(body.preferred_name);
    reply.type('text/html').send(profilePage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_family.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(familyPage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_education.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(educationPage(state));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.ca_education.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as Record<string, unknown>;
    state.education.highSchool = toStr(body.high_school) || state.education.highSchool;
    state.education.graduationYear = toNum(body.graduation_year, state.education.graduationYear);
    state.education.gpaUnweighted = body.gpa_unweighted !== undefined && toStr(body.gpa_unweighted) !== '' ? toNum(body.gpa_unweighted, 0) : null;
    state.education.gpaWeighted = body.gpa_weighted !== undefined && toStr(body.gpa_weighted) !== '' ? toNum(body.gpa_weighted, 0) : null;
    state.education.classRank = body.class_rank !== undefined && toStr(body.class_rank) !== '' ? toNum(body.class_rank, 0) : null;
    reply.type('text/html').send(educationPage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_testing.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(testingPage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_activities.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const query = req.query as Record<string, unknown>;
    const editIdx = query.edit !== undefined ? toNum(query.edit, state.activities.length) : state.activities.length;
    reply.type('text/html').send(activitiesPage(state, Math.max(0, editIdx)));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.ca_activities.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as Record<string, unknown>;
    const index = toNum(body.index, state.activities.length);
    if (index < 0 || index > state.activities.length) {
      reply.code(400).type('text/html').send('<p>invalid activity index</p>');
      return;
    }
    const parsed = MockActivityEntry.safeParse({
      activity_type: toStr(body.activity_type),
      position: toStr(body.position),
      organization: toStr(body.organization),
      description: toStr(body.description),
      grade_levels: toArray(body.grade_levels),
      timing: toArray(body.timing),
      hours_per_week: toNum(body.hours_per_week, 0),
      weeks_per_year: toNum(body.weeks_per_year, 1),
      continue_in_college: toArray(body.continue_in_college).length > 0,
    });
    if (!parsed.success) {
      reply.code(400).type('text/html').send(`<p>invalid activity: ${parsed.error.issues.map((i) => i.message).join('; ')}</p>`);
      return;
    }
    if (index === state.activities.length) state.activities.push(parsed.data);
    else state.activities[index] = parsed.data;
    state.sections.activities = state.activities.length >= 10 ? 'complete' : state.activities.length > 0 ? 'in_progress' : 'not_started';
    reply.type('text/html').send(activitiesPage(state, state.activities.length));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_writing.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(writingPage(state));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.ca_writing.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as Record<string, unknown>;
    const text = toStr(body.essay_text);
    state.writing.text = text;
    state.writing.wordCount = countWords(text);
    state.writing.promptIndex = toNum(body.prompt_index, state.writing.promptIndex);
    state.writing.status = text.trim().length === 0 ? 'not_started' : 'in_progress';
    reply.type('text/html').send(writingPage(state));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.ca_courses_grades.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    reply.type('text/html').send(coursesGradesPage(state));
  });

  // ---- Per-college pages ----
  app.get(toFastifyPath(COMMONAPP_MAP.college_questions.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    reply.type('text/html').send(collegeQuestionsPage(college));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.college_questions.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    const body = req.body as Record<string, unknown>;
    college.questionsAnswers.q_intended_major = toStr(body.q_intended_major);
    college.questionsAnswers.q_additional_info = toStr(body.q_additional_info);
    college.questionsStatus = college.questionsAnswers.q_intended_major !== '' ? 'complete' : 'not_started';
    reply.type('text/html').send(collegeQuestionsPage(college));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.college_writing_supplement.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    reply.type('text/html').send(collegeWritingSupplementPage(college));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.college_recommenders.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    reply.type('text/html').send(collegeRecommendersPage(college));
  });

  app.get(toFastifyPath(COMMONAPP_MAP.college_review_submit.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    reply.type('text/html').send(collegeReviewSubmitPage(college));
  });
  app.post(toFastifyPath(COMMONAPP_MAP.college_review_submit.path), async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { id } = req.params as { id: string };
    const college = findCollege(id);
    if (!college) return reply.code(404).type('text/html').send(notFoundPage());
    // The mock deliberately never changes state here. A real writer must never post to this page
    // at all (see src/guard.ts); this handler only exists so a stray/malicious POST is a safe no-op.
    logger?.warn({ collegeSlug: id }, 'mock common app: ignored a POST to the review-and-completion page');
    reply.type('text/html').send(collegeReviewSubmitPage(college));
  });

  // ---- Admin ----
  app.get('/__state', async (_req, reply) => {
    reply.type('application/json').send(state);
  });
  app.put('/__state', async (req, reply) => {
    state = req.body as MockAccountState;
    reply.type('application/json').send({ ok: true });
  });
  app.post('/__reset', async (_req, reply) => {
    state = defaultMockState();
    sessionEpoch = 0;
    reply.type('application/json').send({ ok: true });
  });
  app.post('/__logout', async (_req, reply) => {
    sessionEpoch += 1;
    reply.type('application/json').send({ ok: true });
  });

  app.setNotFoundHandler(async (_req, reply) => {
    reply.code(404).type('text/html').send(notFoundPage());
  });

  await app.listen({ port: opts.port, host: '127.0.0.1' });
  const address = app.server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : opts.port;

  return {
    url: `http://127.0.0.1:${actualPort}`,
    port: actualPort,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    reset: () => {
      state = defaultMockState();
      sessionEpoch = 0;
    },
    close: async () => {
      await app.close();
    },
  };
}

// Re-exported so callers of `startMockCommonApp` can build a full `MockAccountState` without
// re-deriving these lists themselves (e.g. to compose a custom fixture).
export const MOCK_ACTIVITY_TYPES = ACTIVITY_TYPES;
export const MOCK_GRADE_LEVELS = GRADE_LEVELS;
export const MOCK_ACTIVITY_TIMINGS = ACTIVITY_TIMINGS;
export const MOCK_PER_COLLEGE_PAGES: readonly PageName[] = PER_COLLEGE_PAGES;
