import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, loadHtml, makeExtracted, nullableText, text, type ExtractedResult } from './util';

export interface MyCollegeRow {
  /** Derived from the row's `data-testid` suffix; the correlation key used everywhere else. */
  common_app_college_id: string;
  name: string;
  plan: string | null;
  deadline: string | null;
  questions_status: string;
  writing_supplement_status: string;
  submission_status: string;
}

/** One row per college the student added to Common App — see `commonapp-map.ts` notes on `my_colleges`. */
export function extractMyColleges(html: string): ExtractedResult<MyCollegeRow[]> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.my_colleges.selectors;

  const rows: MyCollegeRow[] = [];
  $(sel.collegeRow).each((_i, el) => {
    const $row = $(el);
    const testid = $row.attr('data-testid') ?? '';
    const id = testid.replace(/^college-row-/, '');
    rows.push({
      common_app_college_id: id,
      name: text($row.find(sel.collegeName)),
      plan: nullableText(text($row.find(sel.collegePlan))),
      deadline: nullableText(text($row.find(sel.collegeDeadline))),
      questions_status: text($row.find(sel.collegeQuestionsStatus)) || 'unknown',
      writing_supplement_status: text($row.find(sel.collegeWritingSupplementStatus)) || 'unknown',
      submission_status: text($row.find(sel.collegeSubmissionStatus)) || 'unknown',
    });
  });

  const anchors = [COMMONAPP_MAP.my_colleges.waitFor, sel.collegeRow, sel.collegeName, sel.collegePlan, sel.collegeDeadline, sel.collegeQuestionsStatus, sel.collegeSubmissionStatus];
  const confidence = anchorConfidence($, anchors);
  const raw = rows.map((r) => `${r.name} (${r.common_app_college_id})`).join('; ');
  return makeExtracted(rows, confidence, raw);
}
