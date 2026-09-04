import { describe, expect, it } from 'vitest';
import { capturedPagesFromFixtures } from '../testing/fixtures';
import { extractSnapshot } from './snapshot';

function collegeByName(colleges: ReturnType<typeof extractSnapshot>['normalized']['colleges'], name: string) {
  const college = colleges.find((c) => c.name === name);
  if (!college) throw new Error(`fixture is missing college "${name}"`);
  return college;
}

describe('extractSnapshot (against generated fixtures — the canonical demo student state)', () => {
  const result = extractSnapshot(capturedPagesFromFixtures(), '2026-09-04T12:00:00Z');

  it('normalizes without throwing and captures the timestamp', () => {
    expect(result.normalized.captured_at).toBe('2026-09-04T12:00:00Z');
  });

  it('extracts exactly the 11 Common App colleges (Georgetown never appears — it uses its own application)', () => {
    const names = result.normalized.colleges.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        'University of Michigan',
        'Northwestern University',
        'University of Chicago',
        'University of Illinois Urbana-Champaign',
        'University of Wisconsin–Madison',
        'Purdue University',
        'Indiana University Bloomington',
        'Washington University in St. Louis',
        'Emory University',
        'Vanderbilt University',
        'Loyola University Chicago',
      ].sort(),
    );
    expect(names).not.toContain('Georgetown University');
  });

  it('extracts plans and deadlines exactly', () => {
    const { colleges } = result.normalized;
    expect(collegeByName(colleges, 'University of Michigan')).toMatchObject({ plan: 'EA', deadline: '2026-11-01' });
    expect(collegeByName(colleges, 'Northwestern University')).toMatchObject({ plan: 'ED', deadline: '2026-11-01' });
    expect(collegeByName(colleges, 'University of Chicago')).toMatchObject({ plan: 'EA', deadline: '2026-11-01' });
    expect(collegeByName(colleges, 'Washington University in St. Louis')).toMatchObject({ plan: 'RD', deadline: '2027-01-02' });
    expect(collegeByName(colleges, 'Emory University')).toMatchObject({ plan: 'RD', deadline: '2027-01-01' });
    expect(collegeByName(colleges, 'Vanderbilt University')).toMatchObject({ plan: 'RD', deadline: '2027-01-01' });
    expect(collegeByName(colleges, 'Loyola University Chicago')).toMatchObject({ plan: 'rolling', deadline: '2026-12-01' });
  });

  it('extracts questions_status exactly', () => {
    const { colleges } = result.normalized;
    expect(collegeByName(colleges, 'University of Michigan').questions_status).toBe('in_progress');
    expect(collegeByName(colleges, 'Northwestern University').questions_status).toBe('not_started');
    expect(collegeByName(colleges, 'University of Chicago').questions_status).toBe('complete');
    expect(collegeByName(colleges, 'Purdue University').questions_status).toBe('not_started');
  });

  it('extracts supplement statuses and word counts exactly', () => {
    const umich = collegeByName(result.normalized.colleges, 'University of Michigan');
    expect(umich.supplements).toEqual([
      { title: 'Community essay', required: true, status: 'complete', word_count: 298 },
      { title: 'Why Michigan', required: true, status: 'in_progress', word_count: 143 },
    ]);

    const uchicago = collegeByName(result.normalized.colleges, 'University of Chicago');
    expect(uchicago.supplements).toEqual([
      { title: 'Why UChicago', required: true, status: 'in_progress', word_count: 102 },
      { title: 'Extended essay', required: true, status: 'not_started', word_count: null },
    ]);

    const indiana = collegeByName(result.normalized.colleges, 'Indiana University Bloomington');
    expect(indiana.supplements).toEqual([]);
    // no supplement prompts at all is a legitimate, fully-confident state
    expect(result.normalized.confidence['college:indiana:supplements']).toBe(1);
  });

  it('extracts recommender names, statuses, and dates exactly', () => {
    const umich = collegeByName(result.normalized.colleges, 'University of Michigan');
    expect(umich.ferpa_status).toBe('complete');
    expect(umich.counselor).toEqual({ name: 'Mr. Diaz', role: 'counselor', status: 'invited', invited_at: '2026-09-01', submitted_at: null, subject: null });
    expect(umich.teachers).toEqual([
      { name: 'Ms. Park', role: 'teacher', status: 'invited', invited_at: '2026-09-02', submitted_at: null, subject: 'AP English Language' },
      { name: 'Mr. Okafor', role: 'teacher', status: 'submitted', invited_at: '2026-08-28', submitted_at: '2026-09-01', subject: 'AP Physics' },
    ]);

    const uiuc = collegeByName(result.normalized.colleges, 'University of Illinois Urbana-Champaign');
    expect(uiuc.counselor).toBeNull();
    expect(uiuc.teachers).toEqual([]);
  });

  it('extracts FERPA complete and fee unpaid on every college', () => {
    for (const college of result.normalized.colleges) {
      expect(college.ferpa_status).toBe('complete');
      expect(college.fee_status).toBe('unpaid');
      expect(college.submission_status).toBe('not_submitted');
    }
  });

  it('extracts Common App section statuses exactly', () => {
    expect(result.normalized.sections).toMatchObject({
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      courses_grades: 'not_started',
    });
  });

  it('extracts the personal essay as prompt 5, 412 words', () => {
    expect(result.normalized.sections.writing).toEqual({ status: 'in_progress', prompt_index: 5, word_count: 412 });
  });

  it('extracts 6 activities entered', () => {
    expect(result.normalized.sections.activities_count).toBe(6);
  });

  it('extracts the self-reported SAT score of 1450', () => {
    expect(result.normalized.testing.self_reported).toEqual([{ test: 'SAT', score: '1450', date: '2026-06-06' }]);
  });

  it('reports full confidence and no low-confidence sections on clean fixtures', () => {
    expect(result.lowConfidenceSections).toEqual([]);
    for (const [key, confidence] of Object.entries(result.normalized.confidence)) {
      expect(confidence, `confidence for "${key}"`).toBe(1);
    }
  });
});

describe('extractSnapshot on a mangled page', () => {
  it('reports low confidence and lists the section, without throwing', () => {
    const pages = capturedPagesFromFixtures();
    // Simulate site drift: every testid on the my-colleges page got renamed.
    pages.my_colleges = (pages.my_colleges as string).replace(/data-testid/g, 'data-broken');

    const result = extractSnapshot(pages, '2026-09-04T12:00:00Z');
    expect(result.lowConfidenceSections).toContain('my_colleges');
    expect(result.normalized.confidence.my_colleges).toBeLessThan(0.5);
    // A mangled my_colleges page means no colleges could be found at all — still a valid, honest snapshot.
    expect(result.normalized.colleges).toEqual([]);
  });

  it('never throws even when a per-college page was never captured at all', () => {
    const pages = capturedPagesFromFixtures();
    delete pages['college_recommenders:umich'];
    expect(() => extractSnapshot(pages, '2026-09-04T12:00:00Z')).not.toThrow();
  });
});
