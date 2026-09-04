import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, bodyRaw, loadHtml, makeExtracted, maskEmail, text, type ExtractedResult } from './util';

export interface DashboardSummary {
  heading: string;
  collegeSummaryCount: number;
  accountEmailMasked: string | null;
}

/**
 * Mostly a login-success / page-state check (see `commonapp-map.ts`): the authoritative college
 * list and status come from `extractMyColleges` and the per-college pages, not from here.
 */
export function extractDashboard(html: string): ExtractedResult<DashboardSummary> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.dashboard.selectors;

  const heading = text($(sel.heading));
  const collegeSummaryCount = $(sel.collegeSummaryList).length;
  const emailText = text($(sel.accountEmail));
  const accountEmailMasked = emailText.length > 0 ? maskEmail(emailText) : null;

  const confidence = anchorConfidence($, [COMMONAPP_MAP.dashboard.waitFor, sel.heading, sel.accountEmail]);
  return makeExtracted({ heading, collegeSummaryCount, accountEmailMasked }, confidence, bodyRaw($).slice(0, 500));
}
