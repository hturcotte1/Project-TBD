import { describe, expect, it } from 'vitest';
import { SchoolRequirementsData } from '../../schemas/requirements';
import { SCHOOL_BY_SLUG, SCHOOL_DATASET } from './index';

const DEMO_SLUGS = [
  'umich',
  'northwestern',
  'uchicago',
  'uiuc',
  'wisconsin',
  'purdue',
  'indiana',
  'georgetown',
  'washu',
  'emory',
  'vanderbilt',
  'loyola-chicago',
];

const MIN_DATE = '2026-10-01';
const MAX_DATE = '2027-08-31';

describe('SCHOOL_DATASET', () => {
  it('has at least 60 entries', () => {
    expect(SCHOOL_DATASET.length).toBeGreaterThanOrEqual(60);
  });

  it('has unique slugs', () => {
    const slugs = SCHOOL_DATASET.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('contains every demo slug, spelled exactly', () => {
    for (const slug of DEMO_SLUGS) {
      expect(SCHOOL_BY_SLUG.has(slug), `missing demo slug: ${slug}`).toBe(true);
    }
  });

  it('every entry parses as SchoolRequirementsData', () => {
    for (const entry of SCHOOL_DATASET) {
      const result = SchoolRequirementsData.safeParse(entry.requirements);
      expect(result.success, `${entry.slug}: ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true);
    }
  });

  it('every entry is for the 2026-27 cycle from the internal dataset', () => {
    for (const entry of SCHOOL_DATASET) {
      expect(entry.requirements.cycle).toBe('2026-27');
      expect(entry.requirements.source).toBe('internal_dataset');
    }
  });

  it('every plan deadline is a valid date within the admission cycle window', () => {
    for (const entry of SCHOOL_DATASET) {
      expect(entry.requirements.plans.length).toBeGreaterThan(0);
      for (const p of entry.requirements.plans) {
        expect(p.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.deadline >= MIN_DATE, `${entry.slug} ${p.plan} deadline ${p.deadline} before ${MIN_DATE}`).toBe(true);
        expect(p.deadline <= MAX_DATE, `${entry.slug} ${p.plan} deadline ${p.deadline} after ${MAX_DATE}`).toBe(true);
      }
    }
  });

  it('every non-Common-App school has a portal_url', () => {
    for (const entry of SCHOOL_DATASET) {
      if (!entry.common_app_member) {
        expect(entry.portal_url, `${entry.slug} is not a Common App member but has no portal_url`).not.toBeNull();
      }
    }
  });

  it('at least 25 entries carry no needs_verification flag at the entry level', () => {
    const confident = SCHOOL_DATASET.filter((e) => !e.requirements.needs_verification);
    expect(confident.length).toBeGreaterThanOrEqual(25);
  });

  it('the well-known non-Common-App schools are flagged correctly', () => {
    for (const slug of ['georgetown', 'mit', 'ucla', 'berkeley', 'ut-austin', 'texas-am', 'washington', 'penn-state']) {
      const entry = SCHOOL_BY_SLUG.get(slug);
      expect(entry, `expected dataset entry for ${slug}`).toBeDefined();
      expect(entry?.common_app_member).toBe(false);
    }
  });

  it('demo schools resolve to the requirements the demo narrative describes', () => {
    const umich = SCHOOL_BY_SLUG.get('umich')!;
    expect(umich.requirements.plans.some((p) => p.plan === 'EA' && p.deadline === '2026-11-01')).toBe(true);
    expect(umich.requirements.supplements.map((s) => s.id).sort()).toEqual(['community_essay', 'why_michigan']);

    const georgetown = SCHOOL_BY_SLUG.get('georgetown')!;
    expect(georgetown.common_app_member).toBe(false);
    expect(georgetown.requirements.plans.some((p) => p.plan === 'RD' && p.deadline === '2027-01-10')).toBe(true);

    const loyola = SCHOOL_BY_SLUG.get('loyola-chicago')!;
    expect(loyola.requirements.plans.some((p) => p.plan === 'rolling' && p.deadline === '2026-12-01')).toBe(true);
  });

  it('UC campuses are test-blind and require no letters of recommendation', () => {
    for (const slug of ['ucla', 'berkeley']) {
      const entry = SCHOOL_BY_SLUG.get(slug)!;
      expect(entry.requirements.test_policy).toBe('blind');
      expect(entry.requirements.recommendations.teacher_min).toBe(0);
      expect(entry.requirements.recommendations.teacher_max).toBe(0);
    }
  });
});
