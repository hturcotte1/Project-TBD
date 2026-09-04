import { SectionStatus as SectionStatusSchema } from '@tbd/shared/schemas';
import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, text, toIntOrNull, type ExtractedResult } from './util';

export interface WritingSection {
  status: 'complete' | 'in_progress' | 'not_started' | 'unknown';
  promptIndex: number | null;
  wordCount: number | null;
  essayText: string;
}

const STATUS_VALUES = SectionStatusSchema.options;

/** The personal essay. `essayText` is used to verify a `fillFields` `personal_essay` write. */
export function extractWriting(html: string): ExtractedResult<WritingSection> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.ca_writing.selectors;

  const status = asEnum(text($(sel.sectionStatus)), STATUS_VALUES, 'unknown');
  const promptIndex = toIntOrNull(text($(sel.promptIndexDisplay)));
  const wordCount = toIntOrNull(text($(sel.wordCount)));
  const essayText = text($(sel.essayTextarea));

  const confidence = anchorConfidence($, [COMMONAPP_MAP.ca_writing.waitFor, sel.sectionStatus, sel.promptIndexDisplay, sel.wordCount, sel.essayTextarea]);
  return makeExtracted({ status, promptIndex, wordCount, essayText }, confidence, `prompt ${promptIndex ?? '?'}, ${wordCount ?? '?'} words`);
}
