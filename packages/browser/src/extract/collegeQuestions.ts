import { SectionStatus as SectionStatusSchema } from '@apogee/shared/schemas';
import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, text, type ExtractedResult } from './util';

export interface CollegeQuestionsSection {
  status: 'complete' | 'in_progress' | 'not_started' | 'unknown';
  answers: { q_intended_major: string; q_additional_info: string };
}

const STATUS_VALUES = SectionStatusSchema.options;

/** Per-college "Questions" tab. See `commonapp-map.ts`: production's question set is per-college. */
export function extractCollegeQuestions(html: string): ExtractedResult<CollegeQuestionsSection> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.college_questions.selectors;

  const status = asEnum(text($(sel.sectionStatus)), STATUS_VALUES, 'unknown');
  const answers = {
    q_intended_major: $(sel.intendedMajorSelect).val()?.toString() ?? '',
    q_additional_info: text($(sel.additionalInfoTextarea)),
  };

  const confidence = anchorConfidence($, [COMMONAPP_MAP.college_questions.waitFor, sel.sectionStatus, sel.intendedMajorSelect, sel.additionalInfoTextarea]);
  return makeExtracted({ status, answers }, confidence, `${answers.q_intended_major} | ${answers.q_additional_info}`);
}
