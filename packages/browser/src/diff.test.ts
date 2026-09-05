import { describe, expect, it } from 'vitest';
import { CommonAppSnapshot } from '@apogee/shared/schemas';
import { diffSnapshots } from './diff';

function baseSnapshot(): CommonAppSnapshot {
  return CommonAppSnapshot.parse({
    captured_at: '2026-09-01T12:00:00Z',
    account_email_masked: 'd***@example.com',
    colleges: [
      {
        name: 'University of Michigan',
        common_app_college_id: 'umich',
        plan: 'EA',
        deadline: '2026-11-01',
        questions_status: 'in_progress',
        supplements: [{ title: 'Why Michigan', required: true, status: 'in_progress', word_count: 100 }],
        writing_supplement_status: 'in_progress',
        ferpa_status: 'complete',
        counselor: { name: 'Mr. Diaz', role: 'counselor', status: 'invited', invited_at: '2026-09-01', submitted_at: null, subject: null },
        teachers: [{ name: 'Ms. Park', role: 'teacher', status: 'invited', invited_at: '2026-09-02', submitted_at: null, subject: 'AP English' }],
        others: [],
        review_submit_status: 'not_ready',
        fee_status: 'unpaid',
        submission_status: 'not_submitted',
        submitted_at: null,
      },
    ],
    sections: {
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      writing: { status: 'in_progress', prompt_index: 5, word_count: 400 },
      courses_grades: 'not_started',
    },
    testing: { self_reported: [{ test: 'SAT', score: '1450', date: '2026-06-06' }], scores_sent_indicators: [] },
    confidence: { my_colleges: 1, sections: 1 },
    low_confidence_sections: [],
  });
}

function withCollege(snap: CommonAppSnapshot, patch: Partial<CommonAppSnapshot['colleges'][number]>): CommonAppSnapshot {
  const clone = structuredClone(snap);
  clone.colleges[0] = { ...(clone.colleges[0] as CommonAppSnapshot['colleges'][number]), ...patch };
  return clone;
}

describe('diffSnapshots — first snapshot (prev === null)', () => {
  it('emits one info college_added change per college and nothing else', () => {
    const next = baseSnapshot();
    const changes = diffSnapshots(null, next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'college_added', significance: 'info', school_name: 'University of Michigan' });
  });
});

describe('diffSnapshots — colleges', () => {
  it('matches colleges by common_app_college_id even if the name changed', () => {
    const prev = baseSnapshot();
    const next = structuredClone(prev);
    if (next.colleges[0]) next.colleges[0].name = 'Univ. of Michigan';
    const changes = diffSnapshots(prev, next);
    expect(changes.find((c) => c.kind === 'college_added')).toBeUndefined();
    expect(changes.find((c) => c.kind === 'college_removed')).toBeUndefined();
  });

  it('matches colleges by case-insensitive name when there is no id', () => {
    const prev = baseSnapshot();
    if (prev.colleges[0]) prev.colleges[0].common_app_college_id = null;
    const next = structuredClone(prev);
    if (next.colleges[0]) {
      next.colleges[0].name = 'university of michigan';
      next.colleges[0].questions_status = 'complete';
    }
    const changes = diffSnapshots(prev, next);
    expect(changes.find((c) => c.kind === 'college_added')).toBeUndefined();
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'college_questions_status' }));
  });

  it('college_added for a brand-new college, college_removed for one that disappeared', () => {
    const prev = baseSnapshot();
    const next = structuredClone(prev);
    next.colleges.push({ ...(structuredClone(prev.colleges[0]) as CommonAppSnapshot['colleges'][number]), name: 'Northwestern University', common_app_college_id: 'northwestern' });
    next.colleges.splice(0, 1);
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'college_added', significance: 'info', school_name: 'Northwestern University' }));
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'college_removed', significance: 'important', school_name: 'University of Michigan' }));
  });

  it('plan_changed and deadline_changed are important', () => {
    const prev = baseSnapshot();
    const next = withCollege(prev, { plan: 'ED', deadline: '2026-10-01' });
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'plan_changed', significance: 'important', before: 'EA', after: 'ED' }));
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'deadline_changed', significance: 'important' }));
  });

  it('college_questions_status change is notable', () => {
    const prev = baseSnapshot();
    const next = withCollege(prev, { questions_status: 'complete' });
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'college_questions_status', significance: 'notable', after: 'complete' }));
  });

  it('supplement becoming complete is notable; word-count-only change is info', () => {
    const prev = baseSnapshot();
    const completed = withCollege(prev, { supplements: [{ title: 'Why Michigan', required: true, status: 'complete', word_count: 250 }] });
    const changes1 = diffSnapshots(prev, completed);
    expect(changes1).toContainEqual(expect.objectContaining({ kind: 'supplement_status', significance: 'notable' }));

    const wordsOnly = withCollege(prev, { supplements: [{ title: 'Why Michigan', required: true, status: 'in_progress', word_count: 150 }] });
    const changes2 = diffSnapshots(prev, wordsOnly);
    expect(changes2).toEqual([expect.objectContaining({ kind: 'supplement_status', significance: 'info', before: 100, after: 150 })]);
  });

  it('recommender submitted is important; recommender invited (new) is notable', () => {
    const prev = baseSnapshot();
    const submitted = withCollege(prev, { teachers: [{ name: 'Ms. Park', role: 'teacher', status: 'submitted', invited_at: '2026-09-02', submitted_at: '2026-09-05', subject: 'AP English' }] });
    const changes1 = diffSnapshots(prev, submitted);
    expect(changes1).toContainEqual(expect.objectContaining({ kind: 'recommender_status', significance: 'important', summary: expect.stringContaining('submitted your University of Michigan recommendation') }));

    const withNewTeacher = withCollege(prev, {
      teachers: [
        { name: 'Ms. Park', role: 'teacher', status: 'invited', invited_at: '2026-09-02', submitted_at: null, subject: 'AP English' },
        { name: 'Mr. Okafor', role: 'teacher', status: 'invited', invited_at: '2026-09-03', submitted_at: null, subject: 'AP Physics' },
      ],
    });
    const changes2 = diffSnapshots(prev, withNewTeacher);
    expect(changes2).toContainEqual(expect.objectContaining({ kind: 'recommender_status', significance: 'notable', school_name: 'University of Michigan' }));
  });

  it('recommender declined is important', () => {
    const prev = baseSnapshot();
    const declined = withCollege(prev, { teachers: [{ name: 'Ms. Park', role: 'teacher', status: 'declined', invited_at: '2026-09-02', submitted_at: null, subject: 'AP English' }] });
    const changes = diffSnapshots(prev, declined);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'recommender_status', significance: 'important' }));
  });

  it('ferpa_status and fee_status changes are notable', () => {
    const prev = baseSnapshot();
    const next = withCollege(prev, { ferpa_status: 'incomplete', fee_status: 'paid' });
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'ferpa_status', significance: 'notable' }));
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'fee_status', significance: 'notable' }));
  });

  it('submission_status change is important', () => {
    const prev = baseSnapshot();
    const next = withCollege(prev, { submission_status: 'submitted', submitted_at: '2026-11-01' });
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'submission_status', significance: 'important', summary: expect.stringContaining('submitted!') }));
  });
});

describe('diffSnapshots — sections', () => {
  it('section_status change is notable', () => {
    const prev = baseSnapshot();
    const next = structuredClone(prev);
    next.sections.education = 'complete';
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'section_status', path: 'sections.education', significance: 'notable' }));
  });

  it('writing status change is writing_status/notable; word-count-only change is writing_status/info', () => {
    const prev = baseSnapshot();
    const statusChange = structuredClone(prev);
    statusChange.sections.writing = { status: 'complete', prompt_index: 5, word_count: 650 };
    const changes1 = diffSnapshots(prev, statusChange);
    expect(changes1.filter((c) => c.kind === 'writing_status')).toContainEqual(expect.objectContaining({ significance: 'notable', path: 'sections.writing.status' }));

    const wordsOnly = structuredClone(prev);
    wordsOnly.sections.writing = { status: 'in_progress', prompt_index: 5, word_count: 420 };
    const changes2 = diffSnapshots(prev, wordsOnly);
    expect(changes2).toEqual([expect.objectContaining({ kind: 'writing_status', significance: 'info', path: 'sections.writing.word_count' })]);
  });

  it('test_scores change is emitted for a new or changed self-reported score', () => {
    const prev = baseSnapshot();
    const next = structuredClone(prev);
    next.testing.self_reported = [{ test: 'SAT', score: '1500', date: '2026-06-06' }];
    const changes = diffSnapshots(prev, next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'test_scores', before: '1450', after: '1500' }));
  });
});
