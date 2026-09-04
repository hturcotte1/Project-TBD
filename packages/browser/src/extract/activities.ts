import { ACTIVITY_TYPES } from '@tbd/shared/domain';
import { COMMONAPP_MAP } from '../commonapp-map';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, text, toBool, toFloatOrNull, toIntOrNull, type ExtractedResult } from './util';

export interface ActivityRow {
  activity_type: string;
  position: string;
  organization: string;
  description: string;
  grade_levels: string[];
  timing: string[];
  hours_per_week: number | null;
  weeks_per_year: number | null;
  continue_in_college: boolean;
}

/** Full row detail (used to verify a `fillFields` activities write, not just for the count/status). */
export function extractActivities(html: string): ExtractedResult<ActivityRow[]> {
  const $ = loadHtml(html);
  const sel = COMMONAPP_MAP.ca_activities.selectors;

  const rows: ActivityRow[] = [];
  $(sel.activityRow).each((_i, el) => {
    const $row = $(el);
    const gradeText = text($row.find(sel.activityGradeLevels));
    const timingText = text($row.find(sel.activityTiming));
    rows.push({
      activity_type: asEnum(text($row.find(sel.activityType)), ACTIVITY_TYPES, 'other'),
      position: text($row.find(sel.activityPosition)),
      organization: text($row.find(sel.activityOrganization)),
      description: text($row.find(sel.activityDescription)),
      grade_levels: gradeText.length > 0 ? gradeText.split(',').map((s) => s.trim()) : [],
      timing: timingText.length > 0 ? timingText.split(',').map((s) => s.trim()) : [],
      hours_per_week: toFloatOrNull(text($row.find(sel.activityHours))),
      weeks_per_year: toIntOrNull(text($row.find(sel.activityWeeks))),
      continue_in_college: toBool(text($row.find(sel.activityContinue))),
    });
  });

  const anchors = [
    COMMONAPP_MAP.ca_activities.waitFor,
    ...(rows.length > 0 ? [sel.activityRow, sel.activityType, sel.activityPosition, sel.activityOrganization, sel.activityHours, sel.activityWeeks] : []),
  ];
  const confidence = anchorConfidence($, anchors);
  const raw = rows.map((r) => `${r.position} @ ${r.organization}`).join('; ');
  return makeExtracted(rows, confidence, raw);
}
