import type { z } from 'zod';
import { CommonAppSnapshot as CommonAppSnapshotSchema } from '@tbd/shared/schemas';
import { extractActivities } from './activities';
import { extractCollegeQuestions } from './collegeQuestions';
import { extractCommonAppSections } from './commonAppSections';
import { extractDashboard } from './dashboard';
import { extractMyColleges } from './myColleges';
import { extractRecommenders, type RecommenderRow } from './recommenders';
import { extractReviewSubmit } from './reviewSubmit';
import { extractTesting } from './testing';
import { asEnum, asEnumOrNull, makeExtracted, toIsoDateOrNull } from './util';
import { extractWritingSupplement, type SupplementRow } from './writingSupplement';

export type CommonAppSnapshotValue = z.infer<typeof CommonAppSnapshotSchema>;
type CollegeSnapshotValue = CommonAppSnapshotValue['colleges'][number];
type RecommenderEntryValue = NonNullable<CollegeSnapshotValue['counselor']>;

/**
 * Every captured page's raw HTML, keyed by page name for org-level pages (`my_colleges`,
 * `ca_profile`, `ca_family`, `ca_education`, `ca_testing`, `ca_activities`, `ca_writing`,
 * `ca_courses_grades`, `dashboard`) and by `"<page>:<collegeId>"` for per-college pages
 * (`college_questions:umich`, `college_writing_supplement:umich`, `college_recommenders:umich`,
 * `college_review_submit:umich`, ...). `collegeId` is whatever `extractMyColleges` reports as
 * `common_app_college_id` for that row — the correlation key used everywhere in this file.
 */
export interface CapturedPages {
  [page: string]: string;
}

export interface ExtractSnapshotResult {
  normalized: CommonAppSnapshotValue;
  /** Every extractor's `raw` (and, for the whole-account fields, `value`), keyed the same as `confidence`. */
  raw: Record<string, unknown>;
  lowConfidenceSections: string[];
}

const APPLICATION_PLAN_VALUES = ['ED', 'ED2', 'EA', 'REA', 'RD', 'rolling'] as const;
const SECTION_STATUS_VALUES = ['complete', 'in_progress', 'not_started', 'unknown'] as const;
const SUBMISSION_STATUS_VALUES = ['not_submitted', 'submitted', 'unknown'] as const;

/** Same rule the mock uses to render the my-colleges summary badge — recomputed here from the authoritative per-college page. */
function aggregateSupplementStatus(supplements: SupplementRow[]): (typeof SECTION_STATUS_VALUES)[number] {
  if (supplements.length === 0) return 'complete';
  if (supplements.every((s) => s.status === 'complete')) return 'complete';
  if (supplements.some((s) => s.status === 'complete' || s.status === 'in_progress')) return 'in_progress';
  return 'not_started';
}

function toRecommenderEntry(r: RecommenderRow): RecommenderEntryValue {
  return { name: r.name, role: r.role, status: r.status, invited_at: toIsoDateOrNull(r.invitedAt), submitted_at: toIsoDateOrNull(r.submittedAt), subject: r.subject };
}

/**
 * Assembles a full `CommonAppSnapshot` from every captured page. Never throws on a partial or
 * garbled capture: missing pages become `'unknown'` statuses and low confidence, not an exception
 * — a failed crawl still produces an honest, storable snapshot.
 */
export function extractSnapshot(pages: CapturedPages, capturedAt: string): ExtractSnapshotResult {
  const confidence: Record<string, number> = {};
  const raw: Record<string, unknown> = {};

  const myColleges = pages.my_colleges !== undefined ? extractMyColleges(pages.my_colleges) : makeExtracted([], 0, '');
  confidence.my_colleges = myColleges.confidence;
  raw.my_colleges = myColleges.raw;

  const dashboard = pages.dashboard !== undefined ? extractDashboard(pages.dashboard) : null;
  if (dashboard) {
    confidence.dashboard = dashboard.confidence;
    raw.dashboard = dashboard.raw;
  }

  const sections = extractCommonAppSections({
    profile: pages.ca_profile,
    family: pages.ca_family,
    education: pages.ca_education,
    testing: pages.ca_testing,
    activities: pages.ca_activities,
    writing: pages.ca_writing,
    courses_grades: pages.ca_courses_grades,
  });
  confidence.sections = sections.confidence;
  raw.sections = sections.raw;

  // Read separately from `sections.activities`: the count there comes from this extractor too,
  // but the full rows are only needed by `client.ts` to verify a fillFields write, not stored here.
  if (pages.ca_activities !== undefined) {
    const activities = extractActivities(pages.ca_activities);
    raw.activities_detail = activities.raw;
  }

  const testingDetail = pages.ca_testing !== undefined ? extractTesting(pages.ca_testing) : makeExtracted({ selfReported: [], scoresSentIndicators: [] }, 0, '');
  confidence.testing = testingDetail.confidence;
  raw.testing = testingDetail.raw;

  const colleges: CollegeSnapshotValue[] = myColleges.value.map((row) => {
    const id = row.common_app_college_id;
    const questions = pages[`college_questions:${id}`] !== undefined ? extractCollegeQuestions(pages[`college_questions:${id}`] as string) : null;
    const supplements = pages[`college_writing_supplement:${id}`] !== undefined ? extractWritingSupplement(pages[`college_writing_supplement:${id}`] as string) : null;
    const recommenders = pages[`college_recommenders:${id}`] !== undefined ? extractRecommenders(pages[`college_recommenders:${id}`] as string) : null;
    const reviewSubmit = pages[`college_review_submit:${id}`] !== undefined ? extractReviewSubmit(pages[`college_review_submit:${id}`] as string) : null;

    if (questions) {
      confidence[`college:${id}:questions`] = questions.confidence;
      raw[`college:${id}:questions`] = questions.raw;
    }
    if (supplements) {
      confidence[`college:${id}:supplements`] = supplements.confidence;
      raw[`college:${id}:supplements`] = supplements.raw;
    }
    if (recommenders) {
      confidence[`college:${id}:recommenders`] = recommenders.confidence;
      raw[`college:${id}:recommenders`] = recommenders.raw;
    }
    if (reviewSubmit) {
      confidence[`college:${id}:review_submit`] = reviewSubmit.confidence;
      raw[`college:${id}:review_submit`] = reviewSubmit.raw;
    }

    const college: CollegeSnapshotValue = {
      name: row.name,
      common_app_college_id: id,
      plan: asEnumOrNull(row.plan ?? '', APPLICATION_PLAN_VALUES),
      deadline: toIsoDateOrNull(row.deadline),
      questions_status: questions?.value.status ?? asEnum(row.questions_status, SECTION_STATUS_VALUES, 'unknown'),
      supplements: (supplements?.value ?? []).map((s) => ({ title: s.title, required: s.required, status: s.status, word_count: s.word_count })),
      writing_supplement_status: supplements ? aggregateSupplementStatus(supplements.value) : 'unknown',
      ferpa_status: recommenders?.value.ferpaStatus ?? 'unknown',
      counselor: recommenders?.value.counselor ? toRecommenderEntry(recommenders.value.counselor) : null,
      teachers: (recommenders?.value.teachers ?? []).map(toRecommenderEntry),
      others: (recommenders?.value.others ?? []).map(toRecommenderEntry),
      review_submit_status: reviewSubmit?.value.reviewSubmitStatus ?? 'unknown',
      fee_status: reviewSubmit?.value.feeStatus ?? 'unknown',
      submission_status: reviewSubmit?.value.submissionStatus ?? asEnum(row.submission_status, SUBMISSION_STATUS_VALUES, 'unknown'),
      submitted_at: toIsoDateOrNull(reviewSubmit?.value.submittedAt ?? null),
    };
    return college;
  });

  const value = {
    captured_at: capturedAt,
    account_email_masked: dashboard?.value.accountEmailMasked ?? null,
    colleges,
    sections: sections.value,
    testing: {
      self_reported: testingDetail.value.selfReported.map((r) => ({ test: r.test, score: r.score, date: toIsoDateOrNull(r.date) })),
      scores_sent_indicators: testingDetail.value.scoresSentIndicators,
    },
    confidence,
    low_confidence_sections: Object.entries(confidence)
      .filter(([, c]) => c < 0.5)
      .map(([k]) => k),
  };

  const normalized = CommonAppSnapshotSchema.parse(value);
  return { normalized, raw, lowConfidenceSections: normalized.low_confidence_sections };
}
