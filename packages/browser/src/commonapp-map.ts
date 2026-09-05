/**
 * The single place for every selector, page path, and extraction anchor used against the Common
 * App website. Nothing outside this file should hardcode a CSS selector for a real page.
 *
 * SITE-DRIFT PROTOCOL: this repo has no access to the real Common App DOM. Every selector below
 * was modeled against the mock site in `src/mock/` (built from `docs/DEMO_STUDENT.md`) and named
 * semantically (data-testid / name / id / heading text) so it degrades gracefully rather than
 * silently misreading the page. Each selector group below carries a "verify against production"
 * note. Before pointing this package at the real Common App, a human must diff these selectors
 * against the live DOM and update this file — the extractors, mock, and fixtures all read from
 * here, so a single edit here is enough to re-target every consumer.
 */

/** Names of every page the reader/writer knows how to visit. */
export type PageName =
  | 'login'
  | 'verification'
  | 'dashboard'
  | 'my_colleges'
  | 'ca_profile'
  | 'ca_family'
  | 'ca_education'
  | 'ca_testing'
  | 'ca_activities'
  | 'ca_writing'
  | 'ca_courses_grades'
  | 'college_questions'
  | 'college_writing_supplement'
  | 'college_recommenders'
  | 'college_review_submit';

/** The four page names that are per-college and need `:collegeId` substituted into `path`. */
export const PER_COLLEGE_PAGES: readonly PageName[] = [
  'college_questions',
  'college_writing_supplement',
  'college_recommenders',
  'college_review_submit',
];

export interface CommonAppPageDef {
  /** Relative to `COMMONAPP_BASE_URL`. Per-college pages contain the literal `:collegeId`. */
  path: string;
  /** Selector Playwright waits for after navigation to consider the page loaded. */
  waitFor: string;
  /** Every selector this page's extractor or writer needs, keyed by a semantic name. */
  selectors: Record<string, string>;
  /** What the page looks like and why each selector was chosen. Read before touching production. */
  notes: string;
}

/** Fills the `:collegeId` placeholder in a per-college page's `path`. */
export function resolveCollegePath(def: CommonAppPageDef, collegeId: string): string {
  return def.path.replace(':collegeId', encodeURIComponent(collegeId));
}

/**
 * Marker present in the top nav on every authenticated page (mock and, we expect, production).
 * Used by `detectPageState` to tell "logged in, page not otherwise recognized" apart from a
 * logged-out shell. VERIFY AGAINST PRODUCTION — production may use a different account menu.
 */
export const AUTHENTICATED_MARKER_SELECTOR = '[data-testid="app-nav"]';

// `satisfies` (not `:`) so every page's `selectors` keeps its precise, named-key object type
// instead of widening to `Record<string, string>` — that widening would make every selector
// access `string | undefined` under `noUncheckedIndexedAccess` even though each page's selector
// set is actually a known, fixed shape.
export const COMMONAPP_MAP = {
  login: {
    path: '/account/login',
    waitFor: '[data-testid="login-form"]',
    selectors: {
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      rememberDeviceCheckbox: 'input[name="remember_device"]',
      // Named "continue", not "submit": the guard's forbidden-word list blocks any selector or
      // visible text containing the standalone word "submit" (see FORBIDDEN_ACTION_PATTERNS
      // below) — logging in must never be mistaken for submitting the application.
      submitButton: '[data-testid="login-continue"]',
      errorBanner: '[data-testid="login-error"]',
    },
    notes:
      'Standard email/password form. "Remember this device" is a checkbox that, when checked, ' +
      'lets a later login skip the verification-code step (mirrored via a cookie in the mock). ' +
      'VERIFY: production login lives at apply.commonapp.org/login and its form field names are ' +
      'not publicly documented; confirm name/id attributes before pointing this at production.',
  },
  verification: {
    path: '/account/verify',
    waitFor: '[data-testid="verification-form"]',
    selectors: {
      codeInput: 'input[name="code"]',
      // Same "continue", not "submit" reasoning as the login page's button, above.
      submitButton: '[data-testid="verification-continue"]',
      errorBanner: '[data-testid="verification-error"]',
      rememberDeviceNote: '[data-testid="verification-remember-note"]',
    },
    notes:
      'Shown after login when the account requires a one-time code (email/SMS in production). ' +
      'VERIFY: production may show this as a modal rather than a full page, and may use a ' +
      'multi-box code input instead of one text field — recheck the DOM shape before use.',
  },
  dashboard: {
    path: '/dashboard',
    waitFor: '[data-testid="dashboard-page"]',
    selectors: {
      heading: '[data-testid="dashboard-heading"]',
      collegeSummaryList: '[data-testid="dashboard-college-summary"]',
      navMyColleges: 'nav a[href="/my-colleges"]',
      accountEmail: '[data-testid="account-email"]',
    },
    notes:
      'Landing page after login; mostly used as a login-success and page-state check, not a ' +
      'primary data source (My Colleges and the per-section pages are authoritative). ' +
      'VERIFY: production dashboard content changes seasonally.',
  },
  my_colleges: {
    path: '/my-colleges',
    waitFor: '[data-testid="my-colleges-page"]',
    selectors: {
      collegeRow: '[data-testid^="college-row-"]',
      collegeName: '[data-testid="college-name"]',
      collegePlan: '[data-testid="college-plan"]',
      collegeDeadline: '[data-testid="college-deadline"]',
      collegeQuestionsStatus: '[data-testid="college-questions-status"]',
      collegeWritingSupplementStatus: '[data-testid="college-writing-supplement-status"]',
      collegeSubmissionStatus: '[data-testid="college-submission-status"]',
      collegeLinkQuestions: 'a[data-testid="college-link-questions"]',
    },
    notes:
      'One row per college the student added to Common App (a college using its own application ' +
      'outside Common App, e.g. Georgetown in the demo data, never appears here). Row order is ' +
      'not guaranteed stable in production; colleges are matched by name/id, never by row index. ' +
      'VERIFY: this is the page most likely to change layout between Common App application ' +
      'cycles (new cycle = new college list UI).',
  },
  ca_profile: {
    path: '/common-app/profile',
    waitFor: '[data-testid="profile-page"]',
    selectors: {
      sectionStatus: '[data-testid="profile-section-status"]',
      firstNameInput: 'input[name="first_name"]',
      lastNameInput: 'input[name="last_name"]',
      preferredNameInput: 'input[name="preferred_name"]',
      saveButton: '[data-testid="profile-save"]',
    },
    notes:
      'Common App tab, "Profile" section. Field names (`first_name`/`last_name`/`preferred_name`) ' +
      'match the `profile.*` paths @apogee/shared\'s `buildProfileFillPayload` already emits — keep ' +
      'them in sync. Only the name fields are wired for writing (level B never needs to write ' +
      'demographics or contact info). VERIFY: production splits Profile into several sub-pages ' +
      '(Personal Info / Contact Info / Demographics); confirm which one holds legal/preferred name.',
  },
  ca_family: {
    path: '/common-app/family',
    waitFor: '[data-testid="family-page"]',
    selectors: { sectionStatus: '[data-testid="family-section-status"]' },
    notes:
      'Common App tab, "Family" section. Read-only in this package (never written by fillFields). ' +
      'VERIFY: confirm the section-status badge selector against production.',
  },
  ca_education: {
    path: '/common-app/education',
    waitFor: '[data-testid="education-page"]',
    selectors: {
      sectionStatus: '[data-testid="education-section-status"]',
      highSchoolNameDisplay: '[data-testid="education-high-school"]',
      highSchoolInput: 'input[name="high_school"]',
      graduationYearInput: 'input[name="graduation_year"]',
      gpaUnweightedInput: 'input[name="gpa_unweighted"]',
      gpaWeightedInput: 'input[name="gpa_weighted"]',
      classRankInput: 'input[name="class_rank"]',
      saveButton: '[data-testid="education-save"]',
    },
    notes:
      'Common App tab, "Education" section. Field names match the `education.*` paths ' +
      '`buildProfileFillPayload` emits (high_school, graduation_year, gpa_unweighted, ' +
      'gpa_weighted, class_rank) even though the "profile" fillFields section spans this page and ' +
      'ca_profile — route by path prefix, not by page. VERIFY: production Education is one of the ' +
      'longer forms (counselor info, courses in progress); this package only writes the school- ' +
      'and GPA-level fields the agent is ever asked to fill.',
  },
  ca_testing: {
    path: '/common-app/testing',
    waitFor: '[data-testid="testing-page"]',
    selectors: {
      sectionStatus: '[data-testid="testing-section-status"]',
      scoreRow: '[data-testid^="testing-score-row-"]',
      scoreTest: '[data-testid="testing-score-test"]',
      scoreValue: '[data-testid="testing-score-value"]',
      scoreDate: '[data-testid="testing-score-date"]',
    },
    notes:
      'Common App tab, "Testing" section, self-reported scores table. Read-only. VERIFY: ' +
      'production may render SAT sub-scores (EBRW/Math) as separate rows rather than one ' +
      'combined-score row; the extractor keeps the raw text either way.',
  },
  ca_activities: {
    path: '/common-app/activities',
    waitFor: '[data-testid="activities-page"]',
    selectors: {
      sectionStatus: '[data-testid="activities-section-status"]',
      activitiesCount: '[data-testid="activities-count"]',
      activityRow: '[data-testid^="activity-row-"]',
      activityType: '[data-testid="activity-type"]',
      activityPosition: '[data-testid="activity-position"]',
      activityOrganization: '[data-testid="activity-organization"]',
      activityDescription: '[data-testid="activity-description"]',
      activityGradeLevels: '[data-testid="activity-grade-levels"]',
      activityTiming: '[data-testid="activity-timing"]',
      activityHours: '[data-testid="activity-hours"]',
      activityWeeks: '[data-testid="activity-weeks"]',
      activityContinue: '[data-testid="activity-continue"]',
      formTypeSelect: 'select[name="activity_type"]',
      formPositionInput: 'input[name="position"]',
      formOrganizationInput: 'input[name="organization"]',
      formDescriptionInput: 'textarea[name="description"]',
      formGradeLevelCheckbox: 'input[name="grade_levels"]',
      formTimingCheckbox: 'input[name="timing"]',
      formHoursInput: 'input[name="hours_per_week"]',
      formWeeksInput: 'input[name="weeks_per_year"]',
      formContinueCheckbox: 'input[name="continue_in_college"]',
      formIndexInput: 'input[name="index"]',
      formSaveButton: '[data-testid="activity-save"]',
    },
    notes:
      'Common App tab, "Activities" section: up to 10 entries, each with the fields in ' +
      '@apogee/shared ActivityInput. The mock exposes one add/edit form that upserts by a hidden ' +
      '"index" field (0-based; index === current length appends). VERIFY: production Common App ' +
      'edits one activity at a time via a modal or a dedicated "/activities/:n" route rather than ' +
      'an inline form — confirm the real write flow before enabling fillFields against it.',
  },
  ca_writing: {
    path: '/common-app/writing',
    waitFor: '[data-testid="writing-page"]',
    selectors: {
      sectionStatus: '[data-testid="writing-section-status"]',
      promptIndexDisplay: '[data-testid="writing-prompt-index"]',
      promptIndexSelect: 'select[name="prompt_index"]',
      wordCount: '[data-testid="writing-word-count"]',
      essayTextarea: 'textarea[name="essay_text"]',
      saveButton: '[data-testid="writing-save"]',
    },
    notes:
      'Common App tab, "Writing" section: the personal essay, one of seven fixed prompts, 650-word ' +
      'limit in production (the mock does not enforce a limit). Field names match the `writing.*` ' +
      'paths `buildPersonalEssayFillPayload` in @apogee/shared emits (`writing.personal_essay` -> ' +
      'essay_text, `writing.prompt_index` -> prompt_index). VERIFY: production may show the prompt ' +
      'as a committed, non-editable choice rather than a <select> — confirm before writing it.',
  },
  ca_courses_grades: {
    path: '/common-app/courses-grades',
    waitFor: '[data-testid="courses-grades-page"]',
    selectors: { sectionStatus: '[data-testid="courses-grades-section-status"]' },
    notes:
      'Common App tab, "Courses & Grades" section (self-reported transcript). Read-only, status ' +
      'only. VERIFY: this section did not exist on Common App before 2019 and its shape has ' +
      'changed more than once; re-check every cycle.',
  },
  college_questions: {
    path: '/college/:collegeId/questions',
    waitFor: '[data-testid="college-questions-page"]',
    selectors: {
      sectionStatus: '[data-testid="questions-section-status"]',
      intendedMajorSelect: 'select[name="q_intended_major"]',
      additionalInfoTextarea: 'textarea[name="q_additional_info"]',
      saveButton: '[data-testid="questions-save"]',
    },
    notes:
      'Per-college "Questions" tab: school-specific short questions (intended major, program ' +
      'interest, additional info). Field names (`q_intended_major`, `q_additional_info`) match the ' +
      '"questions.q_intended_major"-style path the FillFieldsPayload doc-comment in ' +
      '@apogee/shared/schemas/approvals.ts illustrates. The mock only implements the two fields common ' +
      'to most member colleges. VERIFY: production questions differ per college and are fetched ' +
      'from a college-specific question bank — this selector set is illustrative, not exhaustive; a ' +
      'real integration needs a per-college field map, not one fixed shape.',
  },
  college_writing_supplement: {
    path: '/college/:collegeId/writing-supplement',
    waitFor: '[data-testid="writing-supplement-page"]',
    selectors: {
      supplementRow: '[data-testid^="supplement-row-"]',
      supplementTitle: '[data-testid="supplement-title"]',
      supplementStatus: '[data-testid="supplement-status"]',
      supplementWordCount: '[data-testid="supplement-word-count"]',
      supplementRequired: '[data-testid="supplement-required"]',
    },
    notes:
      'Per-college "Writing Supplement" tab: zero or more prompts, each with its own status and ' +
      'word count. Read-only in this package (supplement essays are not in the level-B fillFields ' +
      'section list). VERIFY: production supplement prompts can appear/disappear based on program ' +
      'selections made on the Questions tab; the row set is not fixed.',
  },
  college_recommenders: {
    path: '/college/:collegeId/recommenders',
    waitFor: '[data-testid="recommenders-page"]',
    selectors: {
      ferpaStatus: '[data-testid="ferpa-status"]',
      recommenderRow: '[data-testid^="recommender-row-"]',
      recommenderName: '[data-testid="recommender-name"]',
      recommenderRole: '[data-testid="recommender-role"]',
      recommenderSubject: '[data-testid="recommender-subject"]',
      recommenderStatus: '[data-testid="recommender-status"]',
      recommenderInvitedAt: '[data-testid="recommender-invited-at"]',
      recommenderSubmittedAt: '[data-testid="recommender-submitted-at"]',
    },
    notes:
      'Per-college "Recommenders" tab: the FERPA release status plus one row per invited ' +
      'counselor/teacher/other recommender. Read-only (inviting a recommender is out of scope for ' +
      'this package). VERIFY: production groups recommenders by role in separate tables rather ' +
      'than one list; the extractor reads the role from each row instead of assuming table = role.',
  },
  college_review_submit: {
    path: '/college/:collegeId/review-submit',
    waitFor: '[data-testid="review-submit-page"]',
    selectors: {
      reviewSubmitStatus: '[data-testid="review-submit-status"]',
      feeStatus: '[data-testid="fee-status"]',
      submissionStatus: '[data-testid="submission-status"]',
      submittedAt: '[data-testid="submitted-at"]',
      submitApplicationButton: '[data-testid="submit-application-button"]',
    },
    notes:
      'Per-college "Review & Submit" tab. VISITED READ-ONLY ONLY: this package captures the ' +
      'status badges here (for the checklist and for `submission_status`) and never interacts ' +
      'with the submit button — see `guard.ts`. The button selector is recorded here only so its ' +
      'existence can be asserted in tests; nothing outside the guard tests ever clicks it. ' +
      'VERIFY: production likely paginates review across multiple confirmation steps.',
  },
} satisfies Record<PageName, CommonAppPageDef>;

/** Text patterns that mean the site is showing a maintenance page instead of the app. */
export const MAINTENANCE_MARKERS: RegExp[] = [
  /scheduled maintenance/i,
  /temporarily unavailable/i,
  /down for maintenance/i,
  /we.?ll be back (shortly|soon)/i,
];

/** Text patterns that mean a login attempt was rejected. */
export const LOGIN_ERROR_MARKERS: RegExp[] = [
  /incorrect (email|username) or password/i,
  /invalid credentials/i,
  /we (couldn.?t|could not) sign you in/i,
];

/** Text patterns that mean the site is asking for a one-time verification code. */
export const VERIFICATION_MARKERS: RegExp[] = [
  /enter the (verification|security) code/i,
  /we (sent|emailed|texted) you a code/i,
  /check your (email|phone) for a code/i,
];

/**
 * Whole-word, case-insensitive patterns describing any submit/payment/order-confirmation action.
 * `guard.ts` refuses any selector, visible element text, or navigation URL matching one of these
 * (URLs get a narrow read-only allowlist for the review page — see `guard.ts`). Word-bounded so
 * "payload", "submitted", "fee_status" and similar identifiers never false-positive.
 */
export const FORBIDDEN_ACTION_PATTERNS: RegExp[] = [
  // Contacting third parties is as off-limits as submitting: recommender invitations go through the student.
  /\binvite\b/i,
  /\bsend (an? )?(invitation|invite|request|reminder)\b/i,
  /\bassign (a )?(recommender|counselor|teacher)\b/i,
  /\bsubmit\b/i,
  /\bsubmit application\b/i,
  /\breview and submit\b/i,
  /\bpay\b/i,
  /\bpayment\b/i,
  /\bcheckout\b/i,
  /\bpurchase\b/i,
  /\bfee\b/i,
  /\border\b/i,
  /\bconfirm submission\b/i,
];
