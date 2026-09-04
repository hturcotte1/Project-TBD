import { describe, expect, it } from 'vitest';
import { buildChecklist, buildStudentWideChecklist } from './checklist';
import { SCHOOL_BY_SLUG } from './dataset';
import type { ChecklistApplication, ChecklistInput, ChecklistItemSpec, ChecklistStudent, StudentWideChecklistInput } from './types';

const CAPTURED_AT = '2026-09-03T18:00:00.000Z';
const TODAY = '2026-09-04';

const DEE: ChecklistStudent = {
  testStance: 'submit_selectively',
  hasSatOrAct: true,
  financialConstraints: true,
  firstGeneration: null,
};

function ruleKeys(items: ChecklistItemSpec[]): string[] {
  return items.map((i) => i.ruleKey);
}

function byKey(items: ChecklistItemSpec[], key: string): ChecklistItemSpec {
  const found = items.find((i) => i.ruleKey === key);
  if (!found) throw new Error(`expected an item with ruleKey ${key}`);
  return found;
}

describe('buildChecklist — Michigan EA, demo snapshot state', () => {
  const umich = SCHOOL_BY_SLUG.get('umich');
  if (!umich) throw new Error('umich missing from dataset');

  const application: ChecklistApplication = {
    id: 'app-umich',
    plan: 'EA',
    deadline: '2026-11-01',
    schoolSlug: 'umich',
    schoolName: 'University of Michigan',
    commonAppMember: true,
    status: 'in_progress',
  };

  const input: ChecklistInput = {
    application,
    requirements: umich.requirements,
    snapshotCollege: {
      name: 'University of Michigan',
      common_app_college_id: null,
      plan: 'EA',
      deadline: '2026-11-01',
      questions_status: 'in_progress',
      supplements: [
        { title: 'Community essay', required: true, status: 'complete', word_count: 298 },
        { title: 'Why Michigan', required: true, status: 'in_progress', word_count: 143 },
      ],
      writing_supplement_status: 'unknown',
      ferpa_status: 'complete',
      counselor: { name: 'Mr. Diaz', role: 'counselor', status: 'invited', invited_at: '2026-09-01', submitted_at: null, subject: null },
      teachers: [
        { name: 'Ms. Park', role: 'teacher', status: 'invited', invited_at: '2026-09-02', submitted_at: null, subject: 'AP English Language' },
        { name: 'Mr. Okafor', role: 'teacher', status: 'submitted', invited_at: null, submitted_at: '2026-09-01', subject: 'AP Physics' },
      ],
      others: [],
      review_submit_status: 'not_ready',
      fee_status: 'unpaid',
      submission_status: 'not_submitted',
      submitted_at: null,
    },
    sections: null,
    student: DEE,
    today: TODAY,
    capturedAt: CAPTURED_AT,
  };

  it('produces exactly the expected rule keys, in stable order', () => {
    const items = buildChecklist(input);
    expect(ruleKeys(items)).toEqual([
      'questions',
      'supplement:community_essay',
      'supplement:why_michigan',
      'teacher_rec:1',
      'teacher_rec:2',
      'counselor_rec',
      'ferpa',
      'transcript',
      'score_send',
      'application_fee',
      'fee_waiver',
      'midyear_report',
      'review_submit',
    ]);
  });

  it('derives each status from the snapshot exactly as the demo narrative describes', () => {
    const items = buildChecklist(input);

    expect(byKey(items, 'questions').status).toBe('in_progress');

    const communityEssay = byKey(items, 'supplement:community_essay');
    expect(communityEssay.status).toBe('done');
    expect(communityEssay.evidence?.text).toContain('298 words');

    const whyMichigan = byKey(items, 'supplement:why_michigan');
    expect(whyMichigan.status).toBe('in_progress');
    expect(whyMichigan.evidence?.text).toContain('143 words');

    // Okafor already submitted, so he fills the first (most-progressed) slot; Park is still pending.
    const rec1 = byKey(items, 'teacher_rec:1');
    expect(rec1.status).toBe('done');
    expect(rec1.evidence?.text).toContain('Okafor');
    expect(rec1.evidence?.text).toContain('submitted');

    const rec2 = byKey(items, 'teacher_rec:2');
    expect(rec2.status).toBe('in_progress');
    expect(rec2.evidence?.text).toContain('Park');
    expect(rec2.evidence?.text).toContain('invited');

    expect(byKey(items, 'counselor_rec').status).toBe('in_progress');
    expect(byKey(items, 'ferpa').status).toBe('done');

    const scoreSend = byKey(items, 'score_send');
    expect(scoreSend.status).toBe('missing');
    expect(scoreSend.dueDate).toBe('2026-10-11');

    expect(byKey(items, 'application_fee').status).toBe('missing');

    const feeWaiver = byKey(items, 'fee_waiver');
    expect(feeWaiver.status).toBe('missing');
    expect(feeWaiver.title.toLowerCase()).toContain('fee waiver');

    expect(byKey(items, 'review_submit').status).toBe('missing');
    expect(byKey(items, 'midyear_report').dueDate).toBe('2027-02-15');
  });

  it('is deterministic: the same input twice produces deeply equal output', () => {
    const first = buildChecklist(input);
    const second = buildChecklist(input);
    expect(second).toEqual(first);
  });

  it('omits the fee waiver when the student has no financial constraints', () => {
    const items = buildChecklist({ ...input, student: { ...DEE, financialConstraints: false } });
    expect(ruleKeys(items)).not.toContain('fee_waiver');
  });

  it('omits recommender and Common App section items entirely when there is no snapshot yet', () => {
    const items = buildChecklist({ ...input, snapshotCollege: null, capturedAt: null });
    expect(byKey(items, 'questions').status).toBe('missing');
    expect(byKey(items, 'questions').evidence).toBeNull();
    expect(byKey(items, 'teacher_rec:1').status).toBe('missing');
    expect(byKey(items, 'teacher_rec:1').evidence).toBeNull();
  });
});

describe('buildChecklist — Georgetown RD (non-Common-App)', () => {
  const georgetown = SCHOOL_BY_SLUG.get('georgetown');
  if (!georgetown) throw new Error('georgetown missing from dataset');

  const application: ChecklistApplication = {
    id: 'app-georgetown',
    plan: 'RD',
    deadline: '2027-01-10',
    schoolSlug: 'georgetown',
    schoolName: 'Georgetown University',
    commonAppMember: false,
    status: 'not_started',
  };

  const input: ChecklistInput = {
    application,
    requirements: georgetown.requirements,
    snapshotCollege: null,
    sections: null,
    student: DEE,
    today: TODAY,
    capturedAt: null,
  };

  it('produces only internal-rule items — no Common App section/recommender items', () => {
    const items = buildChecklist(input);
    const keys = ruleKeys(items);

    for (const commonAppOnlyKey of ['questions', 'counselor_rec', 'ferpa', 'review_submit']) {
      expect(keys).not.toContain(commonAppOnlyKey);
    }
    expect(keys.some((k) => k.startsWith('supplement:'))).toBe(false);
    expect(keys.some((k) => k.startsWith('teacher_rec:'))).toBe(false);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.source, `${item.ruleKey} should be internal_rule for a non-Common-App school`).toBe('internal_rule');
    }
  });

  it('still includes score send (test required) and CSS Profile (required) as internal rules', () => {
    const items = buildChecklist(input);
    expect(ruleKeys(items)).toContain('score_send');
    expect(ruleKeys(items)).toContain('css_profile');
  });
});

describe('buildChecklist — score send edge cases', () => {
  const base: ChecklistApplication = {
    id: 'app-x',
    plan: 'RD',
    deadline: '2026-11-30',
    schoolSlug: 'berkeley',
    schoolName: 'University of California, Berkeley',
    commonAppMember: false,
    status: 'not_started',
  };

  it('a test-blind school gets a not_applicable score_send item, not an omitted one', () => {
    const berkeley = SCHOOL_BY_SLUG.get('berkeley');
    if (!berkeley) throw new Error('berkeley missing from dataset');
    expect(berkeley.requirements.test_policy).toBe('blind');

    const items = buildChecklist({
      application: base,
      requirements: berkeley.requirements,
      snapshotCollege: null,
      sections: null,
      student: DEE,
      today: TODAY,
      capturedAt: null,
    });
    const scoreSend = byKey(items, 'score_send');
    expect(scoreSend.status).toBe('not_applicable');
    expect(scoreSend.dueDate).toBeNull();
  });

  it('go_test_optional stance at a test-optional school produces no score_send item at all', () => {
    const northwestern = SCHOOL_BY_SLUG.get('northwestern');
    if (!northwestern) throw new Error('northwestern missing from dataset');
    expect(northwestern.requirements.test_policy).toBe('optional');

    const application: ChecklistApplication = {
      id: 'app-nu',
      plan: 'ED',
      deadline: '2026-11-01',
      schoolSlug: 'northwestern',
      schoolName: 'Northwestern University',
      commonAppMember: true,
      status: 'not_started',
    };
    const items = buildChecklist({
      application,
      requirements: northwestern.requirements,
      snapshotCollege: null,
      sections: null,
      student: { ...DEE, testStance: 'go_test_optional', hasSatOrAct: true },
      today: TODAY,
      capturedAt: null,
    });
    expect(ruleKeys(items)).not.toContain('score_send');
  });
});

describe('buildStudentWideChecklist', () => {
  const input: StudentWideChecklistInput = {
    applications: [],
    sections: {
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      activities_count: 6,
      writing: { status: 'in_progress', prompt_index: 5, word_count: 412 },
      courses_grades: 'not_started',
    },
    testing: {
      self_reported: [{ test: 'SAT', score: '1450', date: '2026-06-06' }],
      scores_sent_indicators: [],
    },
    student: DEE,
    today: TODAY,
    capturedAt: CAPTURED_AT,
    earliestCssDeadline: '2026-11-01',
    needsCss: true,
    earliestFafsaPriority: '2026-12-01',
  };

  it('produces exactly the expected rule keys, in stable order', () => {
    const items = buildStudentWideChecklist(input);
    expect(ruleKeys(items)).toEqual([
      'section:profile',
      'section:family',
      'section:education',
      'section:testing',
      'section:activities',
      'section:courses_grades',
      'writing:personal_essay',
      'fafsa',
    ]);
  });

  it('maps each section status and folds the self-reported SAT score into the testing evidence', () => {
    const items = buildStudentWideChecklist(input);
    expect(byKey(items, 'section:profile').status).toBe('done');
    expect(byKey(items, 'section:family').status).toBe('done');
    expect(byKey(items, 'section:education').status).toBe('in_progress');
    expect(byKey(items, 'section:testing').status).toBe('done');
    expect(byKey(items, 'section:testing').evidence?.text).toContain('SAT 1450');
    expect(byKey(items, 'section:activities').status).toBe('in_progress');
    expect(byKey(items, 'section:courses_grades').status).toBe('missing');

    const writing = byKey(items, 'writing:personal_essay');
    expect(writing.status).toBe('in_progress');
    expect(writing.evidence?.text).toContain('412');
  });

  it('fafsa is due at the earliest priority deadline and mentions CSS when relevant', () => {
    const fafsa = byKey(buildStudentWideChecklist(input), 'fafsa');
    expect(fafsa.dueDate).toBe('2026-12-01');
    expect(fafsa.description).toContain('CSS Profile');
  });

  it('falls back to the default FAFSA due date when no school has a priority deadline', () => {
    const fafsa = byKey(buildStudentWideChecklist({ ...input, earliestFafsaPriority: null }), 'fafsa');
    expect(fafsa.dueDate).toBe('2027-06-30');
  });

  it('omits every Common App section item when there is no sections snapshot yet, but keeps fafsa', () => {
    const items = buildStudentWideChecklist({ ...input, sections: null, capturedAt: null });
    expect(ruleKeys(items)).toEqual(['fafsa']);
  });

  it('is deterministic', () => {
    expect(buildStudentWideChecklist(input)).toEqual(buildStudentWideChecklist(input));
  });
});
