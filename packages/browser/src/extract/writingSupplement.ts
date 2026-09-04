import { SectionStatus as SectionStatusSchema } from '@tbd/shared/schemas';
import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, text, toBool, toIntOrNull, type ExtractedResult } from './util';

export interface SupplementRow {
  title: string;
  required: boolean | null;
  status: 'complete' | 'in_progress' | 'not_started' | 'unknown';
  word_count: number | null;
}

const STATUS_VALUES = SectionStatusSchema.options;

/** Zero or more supplement prompts on a college's "Writing Supplement" tab. Read-only. */
export function extractWritingSupplement(html: string): ExtractedResult<SupplementRow[]> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.college_writing_supplement.selectors;

  const rows: SupplementRow[] = [];
  $(sel.supplementRow).each((_i, el) => {
    const $row = $(el);
    rows.push({
      title: text($row.find(sel.supplementTitle)),
      required: toBool(text($row.find(sel.supplementRequired))),
      status: asEnum(text($row.find(sel.supplementStatus)), STATUS_VALUES, 'unknown'),
      word_count: toIntOrNull(text($row.find(sel.supplementWordCount))),
    });
  });

  // The page container is always expected; the row-level selectors only when a row was found, so
  // a college with zero prompts (a real, valid state) doesn't read as "extraction failed."
  const anchors = [COMMONAPP_MAP.college_writing_supplement.waitFor, ...(rows.length > 0 ? [sel.supplementRow, sel.supplementTitle, sel.supplementStatus, sel.supplementWordCount] : [])];
  const confidence = anchorConfidence($, anchors);
  const raw = rows.map((r) => `${r.title}: ${r.status} (${r.word_count ?? 0}w)`).join('; ');
  return makeExtracted(rows, confidence, raw);
}
