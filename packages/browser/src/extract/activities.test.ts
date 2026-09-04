import { describe, expect, it } from 'vitest';
import { readFixture } from '../testing/fixtures';
import { extractActivities } from './activities';

describe('extractActivities', () => {
  it('extracts all 6 activities with full detail and confidence', () => {
    const result = extractActivities(readFixture('ca_activities'));
    expect(result.confidence).toBe(1);
    expect(result.value).toHaveLength(6);
    expect(result.value[0]).toEqual({
      activity_type: 'journalism_publication',
      position: 'Editor-in-Chief',
      organization: 'The Lincoln Log',
      description:
        'Lead a staff of 14 reporters and editors; assign, edit, and lay out every issue of the school paper; run weekly pitch meetings and manage the print budget.',
      grade_levels: ['10', '11', '12'],
      timing: ['school_year'],
      hours_per_week: 8,
      weeks_per_year: 36,
      continue_in_college: true,
    });
    expect(result.value[2]).toMatchObject({ position: 'Line Cook', organization: "Rosa's Taqueria", hours_per_week: 12, weeks_per_year: 48 });
  });

  it('is fully confident about a legitimately empty activities page', () => {
    const empty = readFixture('ca_activities').replace(/<div data-testid="activity-row-\d+">[\s\S]*?<\/div>\n/g, '');
    const result = extractActivities(empty);
    expect(result.value).toEqual([]);
    expect(result.confidence).toBe(1);
  });

  it('drops confidence when the row markup is mangled', () => {
    const mangled = readFixture('ca_activities').replace(/data-testid/g, 'data-broken');
    const result = extractActivities(mangled);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
