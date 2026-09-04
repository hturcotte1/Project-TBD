import type { z } from 'zod';
import { type CommonAppSections as CommonAppSectionsSchema, SectionStatus as SectionStatusSchema } from '@tbd/shared/schemas';
import { COMMONAPP_MAP } from '../commonapp-map';
import { extractActivities } from './activities';
import { anchorConfidence, asEnum, loadHtml, makeExtracted, text, type ExtractedResult } from './util';
import { extractWriting } from './writing';

export type CaTabName = 'profile' | 'family' | 'education' | 'testing' | 'activities' | 'writing' | 'courses_grades';

export type CommonAppSectionsValue = z.infer<typeof CommonAppSectionsSchema>;

const STATUS_VALUES = SectionStatusSchema.options;

/**
 * Section-level status across every Common App tab. Takes whichever tab pages were captured (a
 * job that failed mid-crawl still produces a partial, honestly-low-confidence snapshot rather
 * than throwing). Delegates to `extractActivities`/`extractWriting` for count/prompt/word-count so
 * that logic lives in one place.
 */
export function extractCommonAppSections(pages: Partial<Record<CaTabName, string>>): ExtractedResult<CommonAppSectionsValue> {
  const confidences: number[] = [];
  const rawParts: string[] = [];

  function readSimpleStatus(mapKey: 'ca_profile' | 'ca_family' | 'ca_education' | 'ca_testing' | 'ca_courses_grades', html: string | undefined): CommonAppSectionsValue['profile'] {
    if (html === undefined) return 'unknown';
    const $ = loadHtml(html);
    const sel = COMMONAPP_MAP[mapKey].selectors;
    confidences.push(anchorConfidence($, [COMMONAPP_MAP[mapKey].waitFor, sel.sectionStatus]));
    const raw = text($(sel.sectionStatus));
    rawParts.push(`${mapKey}:${raw}`);
    return asEnum(raw, STATUS_VALUES, 'unknown');
  }

  const profile = readSimpleStatus('ca_profile', pages.profile);
  const family = readSimpleStatus('ca_family', pages.family);
  const education = readSimpleStatus('ca_education', pages.education);
  const testing = readSimpleStatus('ca_testing', pages.testing);
  const coursesGrades = readSimpleStatus('ca_courses_grades', pages.courses_grades);

  let activities: CommonAppSectionsValue['profile'] = 'unknown';
  let activitiesCount: number | null = null;
  if (pages.activities !== undefined) {
    const $ = loadHtml(pages.activities);
    const sel = COMMONAPP_MAP.ca_activities.selectors;
    const statusConfidence = anchorConfidence($, [COMMONAPP_MAP.ca_activities.waitFor, sel.sectionStatus]);
    const rows = extractActivities(pages.activities);
    activities = asEnum(text($(sel.sectionStatus)), STATUS_VALUES, 'unknown');
    activitiesCount = rows.value.length;
    confidences.push((statusConfidence + rows.confidence) / 2);
    rawParts.push(`activities:${activitiesCount}`);
  }

  let writing: CommonAppSectionsValue['writing'] = { status: 'unknown', prompt_index: null, word_count: null };
  if (pages.writing !== undefined) {
    const w = extractWriting(pages.writing);
    writing = { status: w.value.status, prompt_index: w.value.promptIndex, word_count: w.value.wordCount };
    confidences.push(w.confidence);
    rawParts.push(`writing:${w.raw}`);
  }

  const value: CommonAppSectionsValue = {
    profile,
    family,
    education,
    testing,
    activities,
    activities_count: activitiesCount,
    writing,
    courses_grades: coursesGrades,
  };

  const confidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  return makeExtracted(value, confidence, rawParts.join(' | '));
}
