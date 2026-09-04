import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, nullableText, text, type ExtractedResult } from './util';

const REVIEW_SUBMIT_STATUS_VALUES = ['not_ready', 'ready', 'submitted', 'unknown'] as const;
const FEE_STATUS_VALUES = ['unpaid', 'paid', 'waived', 'not_required', 'unknown'] as const;
const SUBMISSION_STATUS_VALUES = ['not_submitted', 'submitted', 'unknown'] as const;

export interface ReviewSubmitSection {
  reviewSubmitStatus: (typeof REVIEW_SUBMIT_STATUS_VALUES)[number];
  feeStatus: (typeof FEE_STATUS_VALUES)[number];
  submissionStatus: (typeof SUBMISSION_STATUS_VALUES)[number];
  submittedAt: string | null;
}

/**
 * Per-college "Review & Submit" tab, READ ONLY (see `guard.ts` — nothing in this package ever
 * clicks the submit button this page contains; the extractor only reads status badges).
 */
export function extractReviewSubmit(html: string): ExtractedResult<ReviewSubmitSection> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.college_review_submit.selectors;

  const value: ReviewSubmitSection = {
    reviewSubmitStatus: asEnum(text($(sel.reviewSubmitStatus)), REVIEW_SUBMIT_STATUS_VALUES, 'unknown'),
    feeStatus: asEnum(text($(sel.feeStatus)), FEE_STATUS_VALUES, 'unknown'),
    submissionStatus: asEnum(text($(sel.submissionStatus)), SUBMISSION_STATUS_VALUES, 'unknown'),
    submittedAt: nullableText(text($(sel.submittedAt))),
  };

  const confidence = anchorConfidence($, [COMMONAPP_MAP.college_review_submit.waitFor, sel.reviewSubmitStatus, sel.feeStatus, sel.submissionStatus]);
  return makeExtracted(value, confidence, `${value.reviewSubmitStatus}/${value.feeStatus}/${value.submissionStatus}`);
}
