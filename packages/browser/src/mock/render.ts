import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, GRADE_LEVELS } from '@apogee/shared/domain';
import type { MockAccountState, MockActivityEntry, MockCollege, MockRecommender, MockSupplement } from './state';

/** HTML-escapes text before it is interpolated into a template literal. */
export function esc(value: string | number | boolean | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const NAV = `<nav data-testid="app-nav">
  <a href="/dashboard">Dashboard</a>
  <a href="/my-colleges">My Colleges</a>
  <a href="/common-app/profile">Common App</a>
</nav>`;

function layout(opts: { title: string; testid: string; body: string; loggedIn?: boolean }): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>${esc(opts.title)}</title></head>
<body>
${opts.loggedIn ? NAV : ''}
<main data-testid="${opts.testid}">
${opts.body}
</main>
</body>
</html>`;
}

export function maintenancePage(): string {
  return layout({
    title: 'Common App — Maintenance',
    testid: 'maintenance-page',
    body: `<h1>Scheduled maintenance</h1>
<p>Common App is temporarily unavailable while we perform scheduled maintenance. We'll be back shortly — please check back soon.</p>`,
  });
}

export function loginPage(opts: { error?: string } = {}): string {
  return layout({
    title: 'Common App — Log In',
    testid: 'login-page',
    body: `<h1>Log in to Common App</h1>
${opts.error ? `<div data-testid="login-error" role="alert">${esc(opts.error)}</div>` : ''}
<form data-testid="login-form" method="post" action="/account/login">
  <label>Email <input type="email" name="email" /></label>
  <label>Password <input type="password" name="password" /></label>
  <label><input type="checkbox" name="remember_device" value="1" /> Remember this device</label>
  <button type="submit" data-testid="login-continue">Log In</button>
</form>`,
  });
}

export function verificationPage(opts: { error?: string } = {}): string {
  return layout({
    title: 'Common App — Verify',
    testid: 'verification-page',
    body: `<h1>Enter the verification code</h1>
<p>We sent you a code to help verify it's really you.</p>
${opts.error ? `<div data-testid="verification-error" role="alert">${esc(opts.error)}</div>` : ''}
<form data-testid="verification-form" method="post" action="/account/verify">
  <label>Code <input type="text" name="code" /></label>
  <button type="submit" data-testid="verification-continue">Verify</button>
</form>
<p data-testid="verification-remember-note">If you checked "remember this device", you won't need a code next time you log in on this device.</p>`,
  });
}

export function dashboardPage(state: MockAccountState): string {
  const rows = state.colleges
    .map((c) => `<li data-testid="dashboard-college-summary">${esc(c.name)}: ${esc(c.submissionStatus)}</li>`)
    .join('\n');
  return layout({
    title: 'Common App — Dashboard',
    testid: 'dashboard-page',
    loggedIn: true,
    body: `<h1 data-testid="dashboard-heading">Welcome back, ${esc(state.profile.preferredName || state.profile.firstName)}</h1>
<p data-testid="account-email">${esc(state.account.email)}</p>
<ul>${rows}</ul>`,
  });
}

/** Nothing complete, everything in progress -> "in_progress"; nothing to do -> "complete". */
function aggregateSupplementStatus(supplements: MockSupplement[]): string {
  if (supplements.length === 0) return 'complete';
  if (supplements.every((s) => s.status === 'complete')) return 'complete';
  if (supplements.some((s) => s.status === 'complete' || s.status === 'in_progress')) return 'in_progress';
  return 'not_started';
}

export function myCollegesPage(state: MockAccountState): string {
  const rows = state.colleges
    .map(
      (c) => `<div data-testid="college-row-${esc(c.slug)}">
  <span data-testid="college-name">${esc(c.name)}</span>
  <span data-testid="college-plan">${esc(c.plan)}</span>
  <span data-testid="college-deadline">${esc(c.deadline)}</span>
  <span data-testid="college-questions-status">${esc(c.questionsStatus)}</span>
  <span data-testid="college-writing-supplement-status">${esc(aggregateSupplementStatus(c.supplements))}</span>
  <span data-testid="college-submission-status">${esc(c.submissionStatus)}</span>
  <a data-testid="college-link-questions" href="/college/${esc(c.slug)}/questions">Questions</a>
  <a href="/college/${esc(c.slug)}/writing-supplement">Writing Supplement</a>
  <a href="/college/${esc(c.slug)}/recommenders">Recommenders</a>
  <a href="/college/${esc(c.slug)}/review-submit">Review</a>
</div>`,
    )
    .join('\n');
  return layout({ title: 'Common App — My Colleges', testid: 'my-colleges-page', loggedIn: true, body: `<h1>My Colleges</h1>\n${rows}` });
}

export function profilePage(state: MockAccountState): string {
  return layout({
    title: 'Common App — Profile',
    testid: 'profile-page',
    loggedIn: true,
    body: `<h1>Profile</h1>
<p data-testid="profile-section-status">${esc(state.sections.profile)}</p>
<form data-testid="profile-form" method="post" action="/common-app/profile">
  <label>Legal first name <input type="text" name="first_name" value="${esc(state.profile.firstName)}" /></label>
  <label>Legal last name <input type="text" name="last_name" value="${esc(state.profile.lastName)}" /></label>
  <label>Preferred name <input type="text" name="preferred_name" value="${esc(state.profile.preferredName)}" /></label>
  <button type="submit" data-testid="profile-save">Save</button>
</form>`,
  });
}

export function familyPage(state: MockAccountState): string {
  return layout({
    title: 'Common App — Family',
    testid: 'family-page',
    loggedIn: true,
    body: `<h1>Family</h1>\n<p data-testid="family-section-status">${esc(state.sections.family)}</p>`,
  });
}

export function educationPage(state: MockAccountState): string {
  return layout({
    title: 'Common App — Education',
    testid: 'education-page',
    loggedIn: true,
    body: `<h1>Education</h1>
<p data-testid="education-section-status">${esc(state.sections.education)}</p>
<p data-testid="education-high-school">${esc(state.education.highSchool)}</p>
<form data-testid="education-form" method="post" action="/common-app/education">
  <label>High school <input type="text" name="high_school" value="${esc(state.education.highSchool)}" /></label>
  <label>Graduation year <input type="number" name="graduation_year" value="${esc(state.education.graduationYear)}" /></label>
  <label>Unweighted GPA <input type="number" step="0.01" name="gpa_unweighted" value="${esc(state.education.gpaUnweighted)}" /></label>
  <label>Weighted GPA <input type="number" step="0.01" name="gpa_weighted" value="${esc(state.education.gpaWeighted)}" /></label>
  <label>Class rank <input type="number" name="class_rank" value="${esc(state.education.classRank)}" /></label>
  <button type="submit" data-testid="education-save">Save</button>
</form>`,
  });
}

export function testingPage(state: MockAccountState): string {
  const row =
    state.testing.satTotal !== null
      ? `<div data-testid="testing-score-row-sat">
  <span data-testid="testing-score-test">SAT</span>
  <span data-testid="testing-score-value">${esc(state.testing.satTotal)}</span>
  <span data-testid="testing-score-date">${esc(state.testing.satDate)}</span>
</div>`
      : '';
  return layout({
    title: 'Common App — Testing',
    testid: 'testing-page',
    loggedIn: true,
    body: `<h1>Testing</h1>\n<p data-testid="testing-section-status">${esc(state.sections.testing)}</p>\n${row}`,
  });
}

function activityRow(a: MockActivityEntry, idx: number): string {
  return `<div data-testid="activity-row-${idx}">
  <span data-testid="activity-type">${esc(a.activity_type)}</span>
  <span data-testid="activity-position">${esc(a.position)}</span>
  <span data-testid="activity-organization">${esc(a.organization)}</span>
  <span data-testid="activity-description">${esc(a.description)}</span>
  <span data-testid="activity-grade-levels">${esc(a.grade_levels.join(','))}</span>
  <span data-testid="activity-timing">${esc(a.timing.join(','))}</span>
  <span data-testid="activity-hours">${esc(a.hours_per_week)}</span>
  <span data-testid="activity-weeks">${esc(a.weeks_per_year)}</span>
  <span data-testid="activity-continue">${esc(a.continue_in_college)}</span>
  <a href="/common-app/activities?edit=${idx}" data-testid="activity-edit-${idx}">Edit</a>
</div>`;
}

export function activitiesPage(state: MockAccountState, editIdx: number): string {
  const rows = state.activities.map((a, i) => activityRow(a, i)).join('\n');
  const current: MockActivityEntry | null = editIdx < state.activities.length ? (state.activities[editIdx] ?? null) : null;
  const defaults: MockActivityEntry = current ?? {
    activity_type: ACTIVITY_TYPES[0],
    position: '',
    organization: '',
    description: '',
    grade_levels: [],
    timing: [],
    hours_per_week: 0,
    weeks_per_year: 1,
    continue_in_college: false,
  };
  const typeOptions = ACTIVITY_TYPES.map((t) => `<option value="${t}" ${t === defaults.activity_type ? 'selected' : ''}>${t}</option>`).join('');
  const gradeBoxes = GRADE_LEVELS.map(
    (g) => `<label><input type="checkbox" name="grade_levels" value="${g}" ${defaults.grade_levels.includes(g) ? 'checked' : ''}/> ${g}</label>`,
  ).join('\n');
  const timingBoxes = ACTIVITY_TIMINGS.map(
    (t) => `<label><input type="checkbox" name="timing" value="${t}" ${defaults.timing.includes(t) ? 'checked' : ''}/> ${t}</label>`,
  ).join('\n');
  return layout({
    title: 'Common App — Activities',
    testid: 'activities-page',
    loggedIn: true,
    body: `<h1>Activities</h1>
<p data-testid="activities-section-status">${esc(state.sections.activities)}</p>
<p data-testid="activities-count">${state.activities.length}</p>
${rows}
<form data-testid="activity-form" method="post" action="/common-app/activities">
  <input type="hidden" name="index" value="${editIdx}" />
  <label>Type <select name="activity_type">${typeOptions}</select></label>
  <label>Position <input type="text" name="position" value="${esc(defaults.position)}" /></label>
  <label>Organization <input type="text" name="organization" value="${esc(defaults.organization)}" /></label>
  <label>Description <textarea name="description">${esc(defaults.description)}</textarea></label>
  <fieldset><legend>Grade levels</legend>${gradeBoxes}</fieldset>
  <fieldset><legend>Timing</legend>${timingBoxes}</fieldset>
  <label>Hours/week <input type="number" step="0.5" name="hours_per_week" value="${esc(defaults.hours_per_week)}" /></label>
  <label>Weeks/year <input type="number" name="weeks_per_year" value="${esc(defaults.weeks_per_year)}" /></label>
  <label><input type="checkbox" name="continue_in_college" value="1" ${defaults.continue_in_college ? 'checked' : ''}/> Continue in college</label>
  <button type="submit" data-testid="activity-save">Save activity</button>
</form>`,
  });
}

export function writingPage(state: MockAccountState): string {
  const options = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => `<option value="${n}" ${n === state.writing.promptIndex ? 'selected' : ''}>Prompt ${n}</option>`)
    .join('');
  return layout({
    title: 'Common App — Writing',
    testid: 'writing-page',
    loggedIn: true,
    body: `<h1>Writing</h1>
<p data-testid="writing-section-status">${esc(state.writing.status)}</p>
<p data-testid="writing-prompt-index">${state.writing.promptIndex}</p>
<p data-testid="writing-word-count">${state.writing.wordCount}</p>
<form data-testid="writing-form" method="post" action="/common-app/writing">
  <label>Prompt <select name="prompt_index">${options}</select></label>
  <label>Essay <textarea name="essay_text">${esc(state.writing.text)}</textarea></label>
  <button type="submit" data-testid="writing-save">Save</button>
</form>`,
  });
}

export function coursesGradesPage(state: MockAccountState): string {
  return layout({
    title: 'Common App — Courses & Grades',
    testid: 'courses-grades-page',
    loggedIn: true,
    body: `<h1>Courses &amp; Grades</h1>\n<p data-testid="courses-grades-section-status">${esc(state.sections.coursesGrades)}</p>`,
  });
}

const MAJORS = ['undecided', 'biology', 'chemistry', 'computer_science', 'economics', 'english', 'history', 'psychology', 'engineering', 'political_science', 'other'];

export function collegeQuestionsPage(college: MockCollege): string {
  const options = MAJORS.map((m) => `<option value="${m}" ${m === college.questionsAnswers.q_intended_major ? 'selected' : ''}>${m}</option>`).join('');
  return layout({
    title: `${college.name} — Questions`,
    testid: 'college-questions-page',
    loggedIn: true,
    body: `<h1>${esc(college.name)} — Questions</h1>
<p data-testid="questions-section-status">${esc(college.questionsStatus)}</p>
<form data-testid="questions-form" method="post" action="/college/${esc(college.slug)}/questions">
  <label>Intended major <select name="q_intended_major"><option value=""></option>${options}</select></label>
  <label>Additional info <textarea name="q_additional_info">${esc(college.questionsAnswers.q_additional_info)}</textarea></label>
  <button type="submit" data-testid="questions-save">Save</button>
</form>`,
  });
}

export function collegeWritingSupplementPage(college: MockCollege): string {
  const rows = college.supplements
    .map(
      (s, i) => `<div data-testid="supplement-row-${i}">
  <span data-testid="supplement-title">${esc(s.title)}</span>
  <span data-testid="supplement-status">${esc(s.status)}</span>
  <span data-testid="supplement-word-count">${s.wordCount ?? ''}</span>
  <span data-testid="supplement-required">${esc(s.required)}</span>
</div>`,
    )
    .join('\n');
  return layout({
    title: `${college.name} — Writing Supplement`,
    testid: 'writing-supplement-page',
    loggedIn: true,
    body: `<h1>${esc(college.name)} — Writing Supplement</h1>\n${rows || '<p>No supplement prompts for this college.</p>'}`,
  });
}

function recommenderRow(r: MockRecommender, key: string): string {
  return `<div data-testid="recommender-row-${key}">
  <span data-testid="recommender-name">${esc(r.name)}</span>
  <span data-testid="recommender-role">${esc(r.role)}</span>
  <span data-testid="recommender-subject">${esc(r.subject)}</span>
  <span data-testid="recommender-status">${esc(r.status)}</span>
  <span data-testid="recommender-invited-at">${esc(r.invitedAt)}</span>
  <span data-testid="recommender-submitted-at">${esc(r.submittedAt)}</span>
</div>`;
}

export function collegeRecommendersPage(college: MockCollege): string {
  const rows = [
    ...(college.counselor ? [recommenderRow(college.counselor, 'counselor')] : []),
    ...college.teachers.map((t, i) => recommenderRow(t, `teacher-${i}`)),
    ...college.others.map((o, i) => recommenderRow(o, `other-${i}`)),
  ].join('\n');
  return layout({
    title: `${college.name} — Recommenders`,
    testid: 'recommenders-page',
    loggedIn: true,
    body: `<h1>${esc(college.name)} — Recommenders</h1>
<p data-testid="ferpa-status">${esc(college.ferpaStatus)}</p>
${rows || '<p>No recommenders invited yet.</p>'}`,
  });
}

export function collegeReviewSubmitPage(college: MockCollege): string {
  return layout({
    title: `${college.name} — Review & Submit`,
    testid: 'review-submit-page',
    loggedIn: true,
    body: `<h1>${esc(college.name)} — Review &amp; Submit</h1>
<p data-testid="review-submit-status">${esc(college.reviewSubmitStatus)}</p>
<p data-testid="fee-status">${esc(college.feeStatus)}</p>
<p data-testid="submission-status">${esc(college.submissionStatus)}</p>
<p data-testid="submitted-at">${esc(college.submittedAt)}</p>
<form data-testid="review-submit-form" method="post" action="/college/${esc(college.slug)}/review-submit">
  <button type="submit" data-testid="submit-application-button">Submit Application</button>
</form>`,
  });
}

export function notFoundPage(): string {
  return layout({ title: 'Not Found', testid: 'not-found-page', body: '<h1>Not found</h1>' });
}
