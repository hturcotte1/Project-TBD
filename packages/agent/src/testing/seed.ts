import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { scoped, type Db } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { createTestSchool, createTestStudent } from '@apogee/shared/testing';

export interface DemoStudentSeed {
  studentId: string;
  michiganApplicationId: string;
  michiganSchoolId: string;
  georgetownApplicationId: string;
  georgetownSchoolId: string;
  georgetownSuppItemId: string;
  michiganWhyItemId: string;
  reviewSubmitItemId: string;
  essayId: string;
  essayDraftId: string;
  recommenderId: string;
  recommenderAssignmentId: string;
}

/** Seeds a small but realistic student for conversation/injection tests: 2 applications, open items, an essay, a recommender. */
export async function seedDemoStudent(db: Db, overrides: Partial<S.NewStudent> = {}): Promise<DemoStudentSeed> {
  const student = await createTestStudent(db, { timezone: 'America/Chicago', quietHoursStart: '22:00', quietHoursEnd: '07:00', ...overrides });
  const sdb = scoped(db, student.id);

  await sdb.insert(S.studentProfiles, {
    academics: { gpa_weighted: 4.3, gpa_unweighted: 3.8, gpa_scale: 4, class_rank: 41, class_size: 512, rigor_summary: '', senior_courses: [] },
    testScores: { sat: [{ total: 1450, ebrw: 720, math: 730, date: '2026-06-06' }], act: [], ap: [], ib: [], test_optional_stance: 'submit_selectively' },
    demographics: { first_generation: null, financial_constraints: null, family_responsibilities: null, household_notes: null },
    goals: { intended_majors: [], geography: [], sizes: [], cost_sensitivity: 'medium', needs_aid: false, notes: '' },
  });

  const michiganSchool = await createTestSchool(db, { name: 'University of Michigan', slug: `umich-${randomUUID().slice(0, 8)}`, aliases: ['Michigan', 'UMich'] });
  const georgetownSchool = await createTestSchool(db, { name: 'Georgetown University', slug: `georgetown-${randomUUID().slice(0, 8)}`, commonAppMember: false });

  await sdb.insert(S.activities, [
    {
      position: 1,
      activityType: 'journalism_publication',
      positionTitle: 'Editor-in-Chief',
      organization: 'The Lincoln Log',
      description: 'School newspaper',
      gradeLevels: ['10', '11', '12'],
      timing: ['school_year'],
      hoursPerWeek: '8',
      weeksPerYear: 36,
      continueInCollege: true,
    },
    {
      position: 2,
      activityType: 'music_instrumental',
      positionTitle: 'Lead trumpet',
      organization: 'Jazz Band',
      description: 'Jazz band, all four years',
      gradeLevels: ['9', '10', '11', '12'],
      timing: ['all_year'],
      hoursPerWeek: '5',
      weeksPerYear: 40,
      continueInCollege: false,
    },
  ]);

  const [michiganApp] = await sdb.insert(S.applications, { schoolId: michiganSchool.id, plan: 'EA', deadline: '2026-11-01', status: 'in_progress' });
  const [georgetownApp] = await sdb.insert(S.applications, { schoolId: georgetownSchool.id, plan: 'RD', deadline: '2027-01-10', status: 'not_started' });
  if (!michiganApp || !georgetownApp) throw new Error('failed to seed applications');

  const [michiganWhyItem] = await sdb.insert(S.applicationItems, {
    applicationId: michiganApp.id,
    ruleKey: 'supplement:why_michigan',
    kind: 'supplement_essay',
    title: 'Why Michigan',
    description: '',
    source: 'internal_rule',
    status: 'in_progress',
    dueDate: '2026-11-01',
    importance: 80,
    effort: 'large',
    dependsOnOthers: false,
    blocking: true,
  });
  const [georgetownSuppItem] = await sdb.insert(S.applicationItems, {
    applicationId: georgetownApp.id,
    ruleKey: 'supplement:georgetown_short',
    kind: 'supplement_essay',
    title: 'Georgetown supplement',
    description: '',
    source: 'internal_rule',
    status: 'missing',
    dueDate: '2027-01-10',
    importance: 80,
    effort: 'large',
    dependsOnOthers: false,
    blocking: true,
  });
  const [reviewSubmitItem] = await sdb.insert(S.applicationItems, {
    applicationId: michiganApp.id,
    ruleKey: 'review_submit',
    kind: 'review_submit',
    title: 'Review and submit Michigan application',
    description: '',
    source: 'internal_rule',
    status: 'missing',
    dueDate: '2026-11-01',
    importance: 95,
    effort: 'small',
    dependsOnOthers: false,
    blocking: true,
  });
  if (!michiganWhyItem || !georgetownSuppItem || !reviewSubmitItem) throw new Error('failed to seed items');

  await sdb.insert(S.nextActions, [
    {
      applicationItemId: michiganWhyItem.id,
      applicationId: michiganApp.id,
      action: 'Finish "Why Michigan"',
      reason: 'due in 12 days',
      priorityScore: '90',
      rank: 1,
      dueDate: '2026-11-01',
      status: 'open',
    },
    {
      applicationItemId: georgetownSuppItem.id,
      applicationId: georgetownApp.id,
      action: 'Start the Georgetown supplement',
      reason: 'not started yet',
      priorityScore: '70',
      rank: 2,
      dueDate: '2027-01-10',
      status: 'open',
    },
  ]);

  const [essay] = await sdb.insert(S.essays, {
    applicationId: michiganApp.id,
    applicationItemId: michiganWhyItem.id,
    title: 'Why Michigan',
    prompt: 'Why does Michigan appeal to you?',
    wordLimit: 300,
  });
  if (!essay) throw new Error('failed to seed essay');
  const draftContent = 'I have always had a passion for engineering ever since I was young.';
  const [draft] = await sdb.insert(S.essayDrafts, {
    essayId: essay.id,
    version: 1,
    content: draftContent,
    wordCount: draftContent.split(/\s+/).filter(Boolean).length,
    source: 'student_message',
  });
  if (!draft) throw new Error('failed to seed essay draft');
  await sdb.update(S.essays, { currentDraftId: draft.id }, eq(S.essays.id, essay.id));

  const [recommender] = await sdb.insert(S.recommenders, { name: 'Ms. Park', role: 'teacher', email: 'park@lincolnhs.example', inviteStatus: 'invited' });
  if (!recommender) throw new Error('failed to seed recommender');
  const [assignment] = await sdb.insert(S.recommenderAssignments, { recommenderId: recommender.id, applicationId: michiganApp.id, status: 'invited', invitedAt: '2026-09-02' });
  if (!assignment) throw new Error('failed to seed recommender assignment');
  await sdb.insert(S.applicationItems, {
    applicationId: michiganApp.id,
    ruleKey: 'teacher_rec:1',
    kind: 'teacher_rec',
    title: 'Ms. Park recommendation',
    description: '',
    source: 'internal_rule',
    status: 'in_progress',
    dueDate: '2026-11-01',
    importance: 75,
    effort: 'small',
    dependsOnOthers: true,
    blocking: true,
    recommenderId: recommender.id,
  });

  return {
    studentId: student.id,
    michiganApplicationId: michiganApp.id,
    michiganSchoolId: michiganSchool.id,
    georgetownApplicationId: georgetownApp.id,
    georgetownSchoolId: georgetownSchool.id,
    georgetownSuppItemId: georgetownSuppItem.id,
    michiganWhyItemId: michiganWhyItem.id,
    reviewSubmitItemId: reviewSubmitItem.id,
    essayId: essay.id,
    essayDraftId: draft.id,
    recommenderId: recommender.id,
    recommenderAssignmentId: assignment.id,
  };
}
