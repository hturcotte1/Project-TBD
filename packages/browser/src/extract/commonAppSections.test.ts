import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractCommonAppSections } from './commonAppSections';

const CLEAN_PAGES = {
  profile: readFixture('ca_profile'),
  family: readFixture('ca_family'),
  education: readFixture('ca_education'),
  testing: readFixture('ca_testing'),
  activities: readFixture('ca_activities'),
  writing: readFixture('ca_writing'),
  courses_grades: readFixture('ca_courses_grades'),
};

describe('extractCommonAppSections', () => {
  it('extracts every section status, the activities count, and the writing prompt/word count exactly', () => {
    const result = extractCommonAppSections(CLEAN_PAGES);
    expect(result.confidence).toBe(1);
    expect(result.value).toEqual({
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      writing: { status: 'in_progress', prompt_index: 5, word_count: 412 },
      courses_grades: 'not_started',
    });
  });

  it('returns "unknown" statuses (not a throw) for tabs that were never captured', () => {
    const result = extractCommonAppSections({ profile: CLEAN_PAGES.profile });
    expect(result.value.family).toBe('unknown');
    expect(result.value.activities_count).toBeNull();
    expect(result.value.writing).toEqual({ status: 'unknown', prompt_index: null, word_count: null });
  });

  it('drops confidence when most tabs are mangled', () => {
    const broken = (html: string) => html.replace(/data-testid/g, 'data-broken');
    const result = extractCommonAppSections({
      profile: broken(CLEAN_PAGES.profile),
      family: broken(CLEAN_PAGES.family),
      education: broken(CLEAN_PAGES.education),
      testing: broken(CLEAN_PAGES.testing),
      activities: CLEAN_PAGES.activities,
      writing: CLEAN_PAGES.writing,
      courses_grades: broken(CLEAN_PAGES.courses_grades),
    });
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.value.profile).toBe('unknown');
  });
});
