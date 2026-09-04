import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, loadHtml, makeExtracted, text, type ExtractedResult } from './util';

export interface SelfReportedScoreRow {
  test: string;
  score: string;
  date: string | null;
}

export interface TestingSection {
  selfReported: SelfReportedScoreRow[];
  scoresSentIndicators: string[];
}

/** Self-reported scores table on the Common App tab — feeds `CommonAppSnapshot.testing`. */
export function extractTesting(html: string): ExtractedResult<TestingSection> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.ca_testing.selectors;

  const selfReported: SelfReportedScoreRow[] = [];
  $(sel.scoreRow).each((_i, el) => {
    const $row = $(el);
    const dateText = text($row.find(sel.scoreDate));
    selfReported.push({
      test: text($row.find(sel.scoreTest)),
      score: text($row.find(sel.scoreValue)),
      date: dateText.length > 0 ? dateText : null,
    });
  });

  const anchors = [COMMONAPP_MAP.ca_testing.waitFor, ...(selfReported.length > 0 ? [sel.scoreRow, sel.scoreTest, sel.scoreValue, sel.scoreDate] : [])];
  const confidence = anchorConfidence($, anchors);
  const raw = selfReported.map((r) => `${r.test} ${r.score}`).join('; ');
  return makeExtracted({ selfReported, scoresSentIndicators: [] }, confidence, raw);
}
