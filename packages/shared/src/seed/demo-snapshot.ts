/**
 * The normalized Common App state for the demo student, exactly as `docs/DEMO_STUDENT.md`
 * describes it — as if a `full_sync` browser job had just extracted every page. `demo.ts` feeds
 * this straight into `buildChecklist`/`buildStudentWideChecklist` so the seeded checklist and the
 * seeded snapshot always agree, and stores it verbatim as the demo's one `common_app_snapshots`
 * row. Georgetown is deliberately absent from `colleges`: it is not a Common App member, so a
 * real sync would never see it there either.
 */
import type { z } from 'zod';
import { CommonAppSnapshot } from '../schemas';
import type { CollegeSnapshot } from '../schemas';

type CollegeInput = z.input<typeof CollegeSnapshot>;
type RecommenderInput = NonNullable<CollegeInput['counselor']>;

const PARK: RecommenderInput = {
  name: 'Ms. Park',
  role: 'teacher',
  status: 'invited',
  invited_at: '2026-09-02',
  submitted_at: null,
  subject: 'AP English Language',
};

const OKAFOR: RecommenderInput = {
  name: 'Mr. Okafor',
  role: 'teacher',
  status: 'submitted',
  invited_at: '2026-08-28',
  submitted_at: '2026-09-01',
  subject: 'AP Physics',
};

const DIAZ_AT_UMICH: RecommenderInput = {
  name: 'Mr. Diaz',
  role: 'counselor',
  status: 'invited',
  invited_at: '2026-09-01',
  submitted_at: null,
  subject: null,
};

/** Every college the demo student has added to Common App, in the order `docs/DEMO_STUDENT.md` lists them (Georgetown excluded). */
const COLLEGES: CollegeInput[] = [
  {
    name: 'University of Michigan',
    common_app_college_id: 'umich',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'in_progress',
    supplements: [
      { title: 'Community essay', required: true, status: 'complete', word_count: 298 },
      { title: 'Why Michigan', required: true, status: 'in_progress', word_count: 143 },
    ],
    writing_supplement_status: 'in_progress',
    ferpa_status: 'complete',
    counselor: DIAZ_AT_UMICH,
    teachers: [PARK, OKAFOR],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Northwestern University',
    common_app_college_id: 'northwestern',
    plan: 'ED',
    deadline: '2026-11-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Why Northwestern', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [PARK],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'University of Chicago',
    common_app_college_id: 'uchicago',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'complete',
    supplements: [
      { title: 'Why UChicago', required: true, status: 'in_progress', word_count: 102 },
      { title: 'Extended essay', required: true, status: 'not_started', word_count: null },
    ],
    writing_supplement_status: 'in_progress',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [PARK, OKAFOR],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'University of Illinois Urbana-Champaign',
    common_app_college_id: 'uiuc',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Major essay', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'University of Wisconsin–Madison',
    common_app_college_id: 'wisconsin',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Why Wisconsin', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Purdue University',
    common_app_college_id: 'purdue',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Purdue short answers', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Indiana University Bloomington',
    common_app_college_id: 'indiana',
    plan: 'EA',
    deadline: '2026-11-01',
    questions_status: 'not_started',
    supplements: [],
    writing_supplement_status: 'complete',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Washington University in St. Louis',
    common_app_college_id: 'washu',
    plan: 'RD',
    deadline: '2027-01-02',
    questions_status: 'not_started',
    supplements: [{ title: 'Why WashU (optional)', required: false, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Emory University',
    common_app_college_id: 'emory',
    plan: 'RD',
    deadline: '2027-01-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Emory short answers', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Vanderbilt University',
    common_app_college_id: 'vanderbilt',
    plan: 'RD',
    deadline: '2027-01-01',
    questions_status: 'not_started',
    supplements: [{ title: 'Vanderbilt short answer', required: true, status: 'not_started', word_count: null }],
    writing_supplement_status: 'not_started',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
  {
    name: 'Loyola University Chicago',
    common_app_college_id: 'loyola-chicago',
    plan: 'rolling',
    deadline: '2026-12-01',
    questions_status: 'not_started',
    supplements: [],
    writing_supplement_status: 'complete',
    ferpa_status: 'complete',
    counselor: null,
    teachers: [],
    others: [],
    review_submit_status: 'not_ready',
    fee_status: 'unpaid',
    submission_status: 'not_submitted',
    submitted_at: null,
  },
];

/** Extraction confidence, one entry per page a real `full_sync` would have visited — all 1.0. */
function buildConfidence(): Record<string, number> {
  const confidence: Record<string, number> = { my_colleges: 1, dashboard: 1, sections: 1, testing: 1 };
  for (const college of COLLEGES) {
    const id = college.common_app_college_id;
    if (!id) continue;
    confidence[`college:${id}:questions`] = 1;
    confidence[`college:${id}:supplements`] = 1;
    confidence[`college:${id}:recommenders`] = 1;
    confidence[`college:${id}:review_submit`] = 1;
  }
  return confidence;
}

/**
 * Builds the demo student's normalized `CommonAppSnapshot` for a given capture time. Every field
 * matches `docs/DEMO_STUDENT.md` exactly; the shape matches what `packages/browser`'s extractors
 * would have produced from `packages/browser/src/mock/state.ts`'s `defaultMockState()`.
 */
export function demoSnapshot(capturedAt: string): CommonAppSnapshot {
  return CommonAppSnapshot.parse({
    captured_at: capturedAt,
    account_email_masked: 'd***@example.com',
    colleges: COLLEGES,
    sections: {
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      writing: { status: 'in_progress', prompt_index: 5, word_count: 412 },
      courses_grades: 'not_started',
    },
    testing: {
      self_reported: [{ test: 'SAT', score: '1450', date: '2026-06-06' }],
      scores_sent_indicators: [],
    },
    confidence: buildConfidence(),
    low_confidence_sections: [],
  });
}
