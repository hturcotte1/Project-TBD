/**
 * Seeds the canonical demo student described in `docs/DEMO_STUDENT.md` (and the admin account
 * alongside it). Idempotent: re-running deletes and recreates both by `auth_user_id` so the
 * fixture is always exactly this document, never a superset of two runs.
 *
 * Every student-owned row is written through `scoped(db, studentId)`; the student and admin rows
 * themselves are identity rows and are inserted directly.
 */
import { fileURLToPath } from 'node:url';
import { eq, inArray } from 'drizzle-orm';
import * as S from '../db/schema';
import { createDb, type Db } from '../db/client';
import { scoped } from '../db/repos/scoped';
import { appendAudit, conversationsRepo, credentialsRepo, studentsRepo } from '../db/repos/core';
import { loadEnv } from '../config/env';
import { parseKeyRing } from '../crypto/credentials';
import { ONBOARDING_STEP_COUNT } from '../domain/enums';
import type { ApplicationPlan, ApplicationStatus, SelfAssessment } from '../domain/enums';
import { buildChecklist, buildStudentWideChecklist, resolveDeadline, SCHOOL_BY_SLUG } from '../requirements';
import type { ChecklistApplication, ChecklistInput, ChecklistItemSpec, ChecklistStudent, StudentWideChecklistInput } from '../requirements';
import { computeNextActions } from '../prioritize';
import type { PrioritizeApplication, PrioritizeItem } from '../prioritize';
import { BrowserJobResult } from '../schemas';
import type { Academics, Demographics, Goals, StudentNarrative, TestScores } from '../schemas';
import { seedSchools } from './schools';
import { demoSnapshot } from './demo-snapshot';

export const DEMO_STUDENT = {
  email: 'demo@example.com',
  authUserId: 'dev:demo@example.com',
  phoneE164: '+15555550100',
  commonAppEmail: 'demo@example.com',
  commonAppPassword: 'demo-password',
} as const;

const ADMIN = {
  email: 'admin@example.com',
  authUserId: 'dev:admin@example.com',
} as const;

/** Simple, deterministic word count — the same rule used to check every seeded essay draft. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const TODAY = '2026-09-04';
const CAPTURED_AT = '2026-09-03T14:00:00Z';
const SYNCED_AT = new Date('2026-09-03T14:00:00Z');

const DEMO_CHECKLIST_STUDENT: ChecklistStudent = {
  testStance: 'submit_selectively',
  hasSatOrAct: true,
  financialConstraints: true,
  firstGeneration: true,
};

interface DemoApplicationSpec {
  slug: string;
  plan: ApplicationPlan;
  selfAssessment: SelfAssessment;
  status: ApplicationStatus;
}

/** Order matches the table in `docs/DEMO_STUDENT.md`. */
const APPLICATION_SPECS: DemoApplicationSpec[] = [
  { slug: 'umich', plan: 'EA', selfAssessment: 'target', status: 'in_progress' },
  { slug: 'northwestern', plan: 'ED', selfAssessment: 'reach', status: 'not_started' },
  { slug: 'uchicago', plan: 'EA', selfAssessment: 'reach', status: 'in_progress' },
  { slug: 'uiuc', plan: 'EA', selfAssessment: 'safety', status: 'not_started' },
  { slug: 'wisconsin', plan: 'EA', selfAssessment: 'target', status: 'not_started' },
  { slug: 'purdue', plan: 'EA', selfAssessment: 'target', status: 'not_started' },
  { slug: 'indiana', plan: 'EA', selfAssessment: 'safety', status: 'not_started' },
  { slug: 'georgetown', plan: 'RD', selfAssessment: 'reach', status: 'not_started' },
  { slug: 'washu', plan: 'RD', selfAssessment: 'reach', status: 'not_started' },
  { slug: 'emory', plan: 'RD', selfAssessment: 'reach', status: 'not_started' },
  { slug: 'vanderbilt', plan: 'RD', selfAssessment: 'reach', status: 'not_started' },
  { slug: 'loyola-chicago', plan: 'rolling', selfAssessment: 'safety', status: 'not_started' },
];

/** Which teacher fills `teacher_rec:1`, `teacher_rec:2`, ... at each school — the same order
 * `buildChecklist` derives from the snapshot (submitted, then invited, then not-invited). Only
 * schools with a teacher requirement and at least one invited/submitted teacher appear here. */
const TEACHER_REC_ORDER: Record<string, string[]> = {
  umich: ['Mr. Okafor', 'Ms. Park'],
  northwestern: ['Ms. Park'],
  uchicago: ['Mr. Okafor', 'Ms. Park'],
};

const ACADEMICS: Academics = {
  gpa_weighted: 4.31,
  gpa_unweighted: 3.82,
  gpa_scale: 4.0,
  class_rank: 41,
  class_size: 512,
  rigor_summary:
    '7 AP courses by graduation. Unweighted GPA on a 4.0 scale; weighted GPA on a 5.0 scale. Senior year: AP Literature, AP Physics C, AP Statistics, AP Gov, Spanish 5, Jazz Band.',
  senior_courses: ['AP Literature', 'AP Physics C', 'AP Statistics', 'AP Gov', 'Spanish 5', 'Jazz Band'],
};

const TEST_SCORES: TestScores = {
  sat: [{ total: 1450, ebrw: 720, math: 730, date: '2026-06-06' }],
  act: [],
  ap: [
    { subject: 'World History', score: 5, year: 2025 },
    { subject: 'US History', score: 4, year: 2026 },
    { subject: 'Calculus AB', score: 4, year: 2026 },
    { subject: 'English Language', score: 5, year: 2026 },
  ],
  ib: [],
  test_optional_stance: 'submit_selectively',
};

const DEMOGRAPHICS: Demographics = {
  first_generation: true,
  financial_constraints: true,
  family_responsibilities: 'Watches two younger siblings most afternoons',
  household_notes: null,
};

const GOALS: Goals = {
  intended_majors: ['Journalism', 'Political Science'],
  geography: ['Midwest', 'Northeast'],
  sizes: ['medium', 'large'],
  cost_sensitivity: 'high',
  needs_aid: true,
  notes: '',
};

const NARRATIVE: StudentNarrative = {
  themes: [
    {
      title: 'Translator between worlds',
      description:
        "Dee moves between the taqueria, the newsroom, and home, converting one world's language and stakes into terms the next one can act on.",
      evidence: [
        'Chalks the specials board in English under her tia\'s Spanish so regulars know what\'s good.',
        'Rewrote a printing-budget spreadsheet as a pitch the principal could approve.',
      ],
    },
    {
      title: 'Showing up for people',
      description: 'Whether it is siblings, staff writers, or the Friday dinner rush, Dee measures herself by who could count on her showing up.',
      evidence: ['Ten hours a week of after-school childcare for two younger siblings, every year of high school.', 'Tutors 3rd-5th graders weekly at the Boys & Girls Club.'],
    },
  ],
  stories: [
    {
      title: 'The Friday line at Rosa\'s Taqueria',
      summary:
        'Three years into working the line at her family\'s restaurant, Dee reads a room the way she reads a newsroom: who is about to go sideways, what needs to move now.',
      details:
        'Started refilling salsa boats at 14; now runs the line on Friday nights, calling ticket times while training newer cooks. Her abuela\'s recipes are the menu; her tios argue about the books in the back office.',
      what_it_changed: 'Stopped being embarrassed that her after-school job smelled like cumin instead of an internship logo.',
      themes: ['Translator between worlds', 'Showing up for people'],
      fits_prompts: ['Common App personal essay', 'community essay'],
    },
    {
      title: 'The Lincoln Log budget fight',
      summary: 'When the district cut the paper\'s printing budget in half junior year, Dee spent three weeks building a pitch instead of an issue to keep the newsroom alive.',
      details:
        'Translated a budget spreadsheet into a plan the principal could approve: fewer print runs, a real website, ad space sold to shops that already knew her family. The budget was restored, smaller but real.',
      what_it_changed: 'Learned that keeping a community alive sometimes means arguing for it in language the people holding the checkbook will listen to.',
      themes: ['Translator between worlds'],
      fits_prompts: ['community essay', 'why this school'],
    },
    {
      title: 'Homework on a bus tub',
      summary: 'Most weeknights Dee\'s younger siblings do homework on an overturned bus tub in the restaurant\'s back office, because it is the only quiet room left after nine.',
      details: 'Dee is the one who explains school forms and the lease renewal to her parents in plain English, and the one who checks the siblings\' math homework between tickets.',
      what_it_changed: 'Grounded her interest in public policy in a specific, unglamorous fact: what it costs a family when nobody in the building can read a lease easily.',
      themes: ['Showing up for people', 'Translator between worlds'],
      fits_prompts: ['personal essay', 'family background'],
    },
  ],
  values: [
    { name: 'Showing up', why: 'Every commitment in her life — siblings, staff, the line — depends on her actually being there, not just meaning well.' },
    { name: 'Plain language', why: 'She has spent years turning binders, budgets, and leases into sentences her family can use; jargon reads to her as a way of leaving people out.' },
    { name: 'Earning the room', why: 'She does not expect deference — from staff writers or from her tios — and she does not offer it unearned either.' },
  ],
  voice_notes: {
    sentence_style: 'Short, declarative sentences; rarely more than one clause before a full stop.',
    humor: 'Dry, deadpan — she undercuts a big feeling with a joke a beat later, almost every time.',
    vocabulary: 'Plain and specific, not literary. Says "honestly" a lot, usually right before the sentence that matters most.',
    samples: [
      'Honestly, running a newsroom and running a dinner rush use the same muscle.',
      'I am not walking away from any of my worlds to get somewhere better.',
    ],
  },
  cares_about: 'Whether the people closest to her — siblings, staff writers, the regulars at the taqueria — are actually being taken care of, not just told they are.',
  wants_to_do: 'Cover policy the way she edits the school paper: chase the story nobody else will run, and translate it into something a tired parent can use.',
  free_saturday: 'Would spend it prepping the Sunday brunch rush with her tios, then editing pitch memos at the same folding table.',
  proud_of_not_on_resume: 'Taught her younger brother to read a bus schedule so he could get himself to practice when nobody could drive him.',
  home_vs_school: 'At home she is the one who explains things to adults; at school she is still, technically, a kid. She has stopped finding that funny and started finding it useful.',
  family_context: 'Household runs a small restaurant; both parents work long hours, and Dee has been the family\'s de facto translator — literal and otherwise — since middle school.',
  anxieties: 'That leaving for college reads, to her family, like leaving the taqueria behind, when what she actually wants is to come back better at helping it.',
  summary:
    'Dee Demo edits her school paper, works the dinner line at her family\'s taqueria, and gets her younger siblings through their homework most nights — and she has stopped treating any one of those as more serious than the others. ' +
    'Three years ago she was embarrassed that her after-school job smelled like cumin instead of looking good next to an internship on a resume; now it is the story she tells first. ' +
    'What connects the newsroom, the restaurant, and the house is translation: turning a budget spreadsheet into a pitch the principal will approve, turning a lease into words her parents can act on, turning a City Council meeting into something a tired reader can use in five minutes. ' +
    'She wants to study journalism and political science because both are, underneath the coursework, organized translation — and because she has already spent years doing the job for the people who taught her the first language, honestly, at speed, on deadline.',
};

type DemoActivity = Omit<S.NewActivity, 'studentId' | 'position'>;

const ACTIVITIES: DemoActivity[] = [
  {
    activityType: 'journalism_publication',
    positionTitle: 'Editor-in-Chief',
    organization: 'The Lincoln Log',
    description: 'Lead a 14-person staff; assign, edit, and lay out every issue; run the print/web budget.',
    gradeLevels: ['10', '11', '12'],
    timing: ['school_year'],
    hoursPerWeek: '8',
    weeksPerYear: 36,
    continueInCollege: true,
  },
  {
    activityType: 'music_instrumental',
    positionTitle: 'Lead Trumpet',
    organization: 'Jazz Band',
    description: 'First-chair trumpet; solo features at winter and spring concerts and two regional festivals.',
    gradeLevels: ['9', '10', '11', '12'],
    timing: ['all_year'],
    hoursPerWeek: '5',
    weeksPerYear: 40,
    continueInCollege: true,
  },
  {
    activityType: 'work_paid',
    positionTitle: 'Line Cook',
    organization: "Rosa's Taqueria",
    description: "Run the line during dinner rush at my family's restaurant; train new cooks; manage inventory.",
    gradeLevels: ['11', '12'],
    timing: ['all_year'],
    hoursPerWeek: '12',
    weeksPerYear: 48,
    continueInCollege: false,
  },
  {
    activityType: 'community_service',
    positionTitle: 'Tutor',
    organization: 'Boys & Girls Club',
    description: 'Weekly reading and math tutoring for 3rd-5th graders; built a lending library for the site.',
    gradeLevels: ['10', '11', '12'],
    timing: ['school_year'],
    hoursPerWeek: '3',
    weeksPerYear: 30,
    continueInCollege: true,
  },
  {
    activityType: 'family_responsibilities',
    positionTitle: 'Caregiver',
    organization: 'Family',
    description: 'After-school and evening childcare for two younger siblings while parents work.',
    gradeLevels: ['9', '10', '11', '12'],
    timing: ['all_year'],
    hoursPerWeek: '10',
    weeksPerYear: 50,
    continueInCollege: false,
  },
  {
    activityType: 'debate_speech',
    positionTitle: 'Varsity Debater',
    organization: 'Lincoln Debate',
    description: 'Varsity policy debate; qualified for state junior year; mentors novice debaters.',
    gradeLevels: ['9', '10', '11'],
    timing: ['school_year'],
    hoursPerWeek: '6',
    weeksPerYear: 28,
    continueInCollege: true,
  },
  {
    activityType: 'research',
    positionTitle: 'Summer Research Assistant',
    organization: 'UIC Chemistry Lab',
    description: 'Prepped samples and logged data for a summer chemistry research project; not on Common App yet.',
    gradeLevels: ['11'],
    timing: ['school_break'],
    hoursPerWeek: '15',
    weeksPerYear: 8,
    continueInCollege: false,
  },
  {
    activityType: 'student_government',
    positionTitle: 'Junior Class Treasurer',
    organization: 'Lincoln High School',
    description: 'Manage the junior class budget and fundraisers; not yet entered on Common App.',
    gradeLevels: ['11'],
    timing: ['school_year'],
    hoursPerWeek: '2',
    weeksPerYear: 30,
    continueInCollege: false,
  },
];

const PERSONAL_ESSAY_PROMPT =
  'Common App Prompt 5: Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new ' +
  'understanding of yourself or others. The prompt can be about any topic, including a failure, and does not have to be about ' +
  'a positive experience or transformative moment.';

const PERSONAL_ESSAY_V1 = `Every night at Rosa's Taqueria I translate. Not just the specials board, though I do that too, chalking "carnitas hoy" in English underneath my tia's Spanish so the Tuesday regulars know what's good. I translate ticket times into Spanish for the cooks, translate the health inspector's binder into plain sentences my tios can actually use, translate my little brother's third-grade homework into something he can finish before the dinner rush needs him out of the walk-in doorway. I have been the family's translator since I was old enough to read faster than my parents could, and for a long time I thought that made me the exception in every room I walked into: the only cook who also edited a newspaper, the only editor who smelled like cumin during fourth period.

At school I run the newsroom the way I run the pass on a Friday rush: read the room, call the order everyone is about to forget, keep the whole thing moving when the printer jams and a source backs out an hour before deadline. My staff writers think I learned that from three years as editor. Really I learned it first behind a griddle that never fully cools between lunch and dinner.

I used to think I would leave the taqueria behind once I had somewhere better to be. I do not think that anymore. My siblings still do homework on an overturned bus tub because the back office is the only quiet room left after nine, and I am still the one who explains the lease renewal to my parents in words the landlord's lawyer did not bother to. What changed is that I stopped being embarrassed about it. Debate taught me to build an argument. The taqueria taught me who the argument is actually for.

I want to study journalism and political science because both are just organized translation: turning a City Council meeting into something a tired parent can read in five minutes, turning a policy into a decision someone can actually make. I am not walking away from my worlds to get there. I am trying to become fluent enough in all of them to keep translating for the people who taught me the first language, on both sides of the counter, honestly, at speed.`;

const PERSONAL_ESSAY_V2 = `Every night at Rosa's Taqueria I translate. Not just the specials board, though I do that too, chalking "carnitas hoy" in English underneath my tia's Spanish so the Tuesday regulars know what's good. I translate ticket times into Spanish for the cooks, translate the health inspector's binder into plain sentences my tios can actually use, translate my little brother's third-grade homework into something he can finish before the dinner rush needs him out of the walk-in doorway. I have been the family's translator since I was old enough to read faster than my parents could, and for a long time I thought that made me the exception in every room I walked into: the only cook who also edited a newspaper, the only editor who smelled like cumin during fourth period.

Junior year the district cut our printing budget in half. I could have quietly halved the paper too, but instead I spent three weeks translating a budget spreadsheet into a pitch our principal could actually approve: fewer print issues, a real website, ad space sold to the same shops that already knew my family. It worked, and I learned that translating is not just carrying words across a gap. It is deciding which version of the truth a particular room is ready to hear, and saying it anyway.

I used to think I would leave the taqueria behind once I had somewhere better to be. I do not think that anymore. My siblings still do homework on an overturned bus tub because the back office is the only quiet room left after nine, and I am still the one who explains the lease renewal to my parents in words the landlord's lawyer did not bother to. What changed is that I stopped being embarrassed about it. Debate taught me to build an argument. The taqueria taught me who the argument is actually for, and the newsroom taught me how to get it printed before the deadline moved again.

I want to study journalism and political science because both are just organized translation: turning a City Council meeting into something a tired parent can read in five minutes, turning a policy into a decision someone can actually make. I am not walking away from my worlds to get there. I am trying to become fluent enough in all of them to keep translating for the people who taught me the first language: honestly, at speed, on deadline, on both sides of the counter.`;

const COMMUNITY_ESSAY_DRAFT = `The Lincoln Log newsroom meets in a windowless room that used to be a supply closet, fourteen of us around two folding tables at 7:15 every morning before first period. It is not a glamorous community. Half of us are there because a teacher recruited us out of freshman English; the rest showed up because they had a story nobody else would run. What holds us together is a rule I inherited from the editor before me and now enforce myself: nobody's byline gets special treatment, and nobody's story runs unchecked, no matter whose friend wrote it.

My place in that community used to be simple — I was the kid who could turn in copy on time. It got complicated the year our printing budget was cut in half and I had to decide, in front of fourteen people who trusted me, whether the paper that had made room for all of us would keep existing at all. I spent three weeks building a pitch instead of an issue: fewer print runs, a real website, ad space sold to shops in my own neighborhood who already knew my last name. Some of my staff thought I was giving up on print. I was trying to keep the community itself alive, even if the object we made together looked different.

We got the budget restored, smaller but real, and the newsroom is still the windowless room at 7:15. What I understand now that I didn't as a freshman is that a community survives not because everyone agrees, but because someone argues for its existence in language the people holding the checkbook will listen to. That is the job I keep signing up for, in the newsroom and everywhere else: translator, advocate, the one who stays until the last page is proofed.`;

const WHY_MICHIGAN_DRAFT = `I want the newsroom at the Michigan Daily, not just the classroom, because I have already learned more about deadlines and budgets running a school paper than any single syllabus could teach me, and I want editors who will push that instinct further instead of starting me over from zero. The Wolverine Media Group's mix of student-run outlets means I could keep the same instinct I have now — chase the story nobody else will run — while learning from people who have covered actual statehouses, not just school boards. I am applying to the Gerald R. Ford School's public policy program specifically because Michigan treats journalism and policy as neighbors, not strangers, and because a campus this large will finally give me an audience bigger than fourteen people around two folding tables in a converted supply closet before first period.`;

const WHY_UCHICAGO_DRAFT = `I want a Core that will not let me get away with the easy version of an argument, because I already run a newsroom where the easy version is the one nobody bothers to fact-check. UChicago students argue about ideas the way my tios argue about the books after close — loudly, specifically, and because they actually care who wins. I want to write for the Maroon, take a class that makes me defend an argument line by line, and find out whether the instincts I built behind a taqueria counter hold up against people trained to take them apart.`;

function supplementPrompt(slug: string, id: string): string {
  const entry = SCHOOL_BY_SLUG.get(slug);
  if (!entry) throw new Error(`missing dataset entry for school "${slug}"`);
  const supplement = entry.requirements.supplements.find((s) => s.id === id);
  if (!supplement) throw new Error(`missing supplement "${id}" for school "${slug}"`);
  return supplement.prompt;
}

function requireOne<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`${what}: insert returned no row`);
  return row;
}

export interface SeedDemoStudentResult {
  studentId: string;
  adminId: string;
}

export async function seedDemoStudent(db: Db, opts: { now?: Date } = {}): Promise<SeedDemoStudentResult> {
  const now = opts.now ?? new Date();

  // ---------- idempotency: delete-and-recreate both identity rows ----------
  const existingDemo = await studentsRepo.findByAuthUserId(db, DEMO_STUDENT.authUserId);
  if (existingDemo) await db.delete(S.students).where(eq(S.students.id, existingDemo.id));
  const existingAdmin = await studentsRepo.findByAuthUserId(db, ADMIN.authUserId);
  if (existingAdmin) await db.delete(S.students).where(eq(S.students.id, existingAdmin.id));

  const admin = requireOne(
    await db
      .insert(S.students)
      .values({
        authUserId: ADMIN.authUserId,
        email: ADMIN.email,
        role: 'admin',
        status: 'active',
        firstName: 'Admin',
        lastName: 'User',
        preferredName: 'Admin',
        onboardingStep: ONBOARDING_STEP_COUNT,
        onboardingCompletedAt: now,
      })
      .returning(),
    'admin',
  );

  const student = requireOne(
    await db
      .insert(S.students)
      .values({
        authUserId: DEMO_STUDENT.authUserId,
        email: DEMO_STUDENT.email,
        role: 'student',
        status: 'active',
        firstName: 'Dee',
        lastName: 'Demo',
        preferredName: 'Dee',
        phoneE164: DEMO_STUDENT.phoneE164,
        highSchool: 'Lincoln High School',
        graduationYear: 2027,
        timezone: 'America/Chicago',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        nudgeIntensity: 'normal',
        onboardingStep: ONBOARDING_STEP_COUNT,
        onboardingCompletedAt: new Date('2026-09-01T15:00:00Z'),
        welcomeSentAt: new Date('2026-09-01T15:05:00Z'),
      })
      .returning(),
    'student',
  );

  const sdb = scoped(db, student.id);

  // ---------- profile, narrative, activities ----------
  await sdb.insert(S.studentProfiles, { academics: ACADEMICS, testScores: TEST_SCORES, demographics: DEMOGRAPHICS, goals: GOALS });
  await sdb.insert(S.studentNarratives, { version: 1, narrative: NARRATIVE, interviewConversationId: null });
  await sdb.insert(
    S.activities,
    ACTIVITIES.map((a, i) => ({ position: i + 1, ...a })),
  );

  // ---------- schools & requirements ----------
  await seedSchools(db);
  const slugs = APPLICATION_SPECS.map((s) => s.slug);
  const schoolRows = await db.select().from(S.schools).where(inArray(S.schools.slug, slugs));
  const schoolBySlug = new Map(schoolRows.map((s) => [s.slug, s]));

  // ---------- applications ----------
  const applicationBySlug = new Map<string, S.Application>();
  for (const spec of APPLICATION_SPECS) {
    const school = schoolBySlug.get(spec.slug);
    if (!school) throw new Error(`school row missing for slug "${spec.slug}"`);
    const datasetEntry = SCHOOL_BY_SLUG.get(spec.slug);
    if (!datasetEntry) throw new Error(`dataset entry missing for slug "${spec.slug}"`);
    const resolved = resolveDeadline(datasetEntry.requirements, spec.plan);
    if (!resolved) throw new Error(`no ${spec.plan} plan for "${spec.slug}"`);

    const application = requireOne(
      await sdb.insert(S.applications, {
        schoolId: school.id,
        plan: spec.plan,
        deadline: resolved.deadline,
        deadlineSource: 'internal_dataset',
        status: spec.status,
        selfAssessment: spec.selfAssessment,
        commonAppCollegeId: datasetEntry.common_app_member ? datasetEntry.slug : null,
        lastSyncedAt: SYNCED_AT,
      }),
      `application:${spec.slug}`,
    );
    applicationBySlug.set(spec.slug, application);
  }

  // ---------- Common App snapshot (built before the checklist so both agree) ----------
  const snapshot = demoSnapshot(CAPTURED_AT);
  const collegeBySlug = new Map(snapshot.colleges.map((c) => [c.common_app_college_id ?? '', c]));

  // ---------- application items (per application + student-wide) ----------
  const allItems: S.ApplicationItem[] = [];
  const itemsByApp = new Map<string, S.ApplicationItem[]>();

  function toItemValues(applicationId: string | null, spec: ChecklistItemSpec): Omit<S.NewApplicationItem, 'studentId'> {
    return {
      applicationId,
      ruleKey: spec.ruleKey,
      kind: spec.kind,
      title: spec.title,
      description: spec.description,
      source: spec.source,
      status: spec.status,
      evidence: spec.evidence,
      dueDate: spec.dueDate,
      importance: spec.importance,
      effort: spec.effort,
      dependsOnOthers: spec.dependsOnOthers,
      blocking: spec.blocking,
      lastCheckedAt: spec.evidence ? new Date(spec.evidence.seen_at) : null,
      completedAt: spec.status === 'done' ? SYNCED_AT : null,
    };
  }

  for (const spec of APPLICATION_SPECS) {
    const application = applicationBySlug.get(spec.slug);
    const datasetEntry = SCHOOL_BY_SLUG.get(spec.slug);
    if (!application || !datasetEntry) throw new Error(`missing setup for "${spec.slug}"`);

    const checklistApplication: ChecklistApplication = {
      id: application.id,
      plan: spec.plan,
      deadline: application.deadline,
      schoolSlug: spec.slug,
      schoolName: datasetEntry.name,
      commonAppMember: datasetEntry.common_app_member,
      status: spec.status,
    };
    const input: ChecklistInput = {
      application: checklistApplication,
      requirements: datasetEntry.requirements,
      snapshotCollege: collegeBySlug.get(spec.slug) ?? null,
      sections: snapshot.sections,
      student: DEMO_CHECKLIST_STUDENT,
      today: TODAY,
      capturedAt: CAPTURED_AT,
    };
    const specs = buildChecklist(input);
    const rows = await sdb.insert(
      S.applicationItems,
      specs.map((s) => toItemValues(application.id, s)),
    );
    itemsByApp.set(spec.slug, rows);
    allItems.push(...rows);
  }

  const studentWideInput: StudentWideChecklistInput = {
    applications: APPLICATION_SPECS.map((spec) => {
      const application = applicationBySlug.get(spec.slug);
      const datasetEntry = SCHOOL_BY_SLUG.get(spec.slug);
      if (!application || !datasetEntry) throw new Error(`missing setup for "${spec.slug}"`);
      return {
        id: application.id,
        plan: spec.plan,
        deadline: application.deadline,
        schoolSlug: spec.slug,
        schoolName: datasetEntry.name,
        commonAppMember: datasetEntry.common_app_member,
        status: spec.status,
      };
    }),
    sections: snapshot.sections,
    testing: snapshot.testing,
    student: DEMO_CHECKLIST_STUDENT,
    today: TODAY,
    capturedAt: CAPTURED_AT,
    earliestCssDeadline: '2026-11-01',
    needsCss: true,
    earliestFafsaPriority: null,
  };
  const studentWideSpecs = buildStudentWideChecklist(studentWideInput);
  const studentWideRows = await sdb.insert(
    S.applicationItems,
    studentWideSpecs.map((s) => toItemValues(null, s)),
  );
  allItems.push(...studentWideRows);

  function findItem(applicationId: string | null, ruleKey: string): S.ApplicationItem {
    const row = allItems.find((i) => i.applicationId === applicationId && i.ruleKey === ruleKey);
    if (!row) throw new Error(`application item not found: application=${applicationId ?? 'null'} ruleKey=${ruleKey}`);
    return row;
  }

  // ---------- essays & drafts ----------
  const umich = applicationBySlug.get('umich');
  const uchicago = applicationBySlug.get('uchicago');
  const northwestern = applicationBySlug.get('northwestern');
  if (!umich || !uchicago || !northwestern) throw new Error('expected applications missing');

  const personalEssayItem = findItem(null, 'writing:personal_essay');
  const communityEssayItem = findItem(umich.id, 'supplement:community_essay');
  const whyMichiganItem = findItem(umich.id, 'supplement:why_michigan');
  const whyUchicagoItem = findItem(uchicago.id, 'supplement:why_uchicago');
  const whyNorthwesternItem = findItem(northwestern.id, 'supplement:why_northwestern');

  const personalEssay = requireOne(
    await sdb.insert(S.essays, {
      applicationId: null,
      applicationItemId: personalEssayItem.id,
      title: 'Personal essay',
      prompt: PERSONAL_ESSAY_PROMPT,
      wordLimit: 650,
    }),
    'essay:personal',
  );
  await sdb.insert(S.essayDrafts, {
    essayId: personalEssay.id,
    version: 1,
    content: PERSONAL_ESSAY_V1,
    wordCount: wordCount(PERSONAL_ESSAY_V1),
    source: 'dashboard_editor',
    createdAt: new Date('2026-08-20T20:00:00Z'),
  });
  const personalV2 = requireOne(
    await sdb.insert(S.essayDrafts, {
      essayId: personalEssay.id,
      version: 2,
      content: PERSONAL_ESSAY_V2,
      wordCount: wordCount(PERSONAL_ESSAY_V2),
      source: 'dashboard_editor',
      createdAt: new Date('2026-09-01T20:00:00Z'),
    }),
    'essayDraft:personal:v2',
  );
  await sdb.update(S.essays, { currentDraftId: personalV2.id }, eq(S.essays.id, personalEssay.id));
  await sdb.update(S.applicationItems, { essayId: personalEssay.id }, eq(S.applicationItems.id, personalEssayItem.id));

  const communityEssay = requireOne(
    await sdb.insert(S.essays, {
      applicationId: umich.id,
      applicationItemId: communityEssayItem.id,
      title: 'Community essay',
      prompt: supplementPrompt('umich', 'community_essay'),
      wordLimit: 300,
    }),
    'essay:community',
  );
  const communityDraft = requireOne(
    await sdb.insert(S.essayDrafts, {
      essayId: communityEssay.id,
      version: 1,
      content: COMMUNITY_ESSAY_DRAFT,
      wordCount: wordCount(COMMUNITY_ESSAY_DRAFT),
      source: 'dashboard_editor',
      createdAt: new Date('2026-08-28T20:00:00Z'),
    }),
    'essayDraft:community',
  );
  await sdb.update(S.essays, { currentDraftId: communityDraft.id }, eq(S.essays.id, communityEssay.id));
  await sdb.update(S.applicationItems, { essayId: communityEssay.id }, eq(S.applicationItems.id, communityEssayItem.id));

  const whyMichigan = requireOne(
    await sdb.insert(S.essays, {
      applicationId: umich.id,
      applicationItemId: whyMichiganItem.id,
      title: 'Why Michigan',
      prompt: supplementPrompt('umich', 'why_michigan'),
      wordLimit: 300,
    }),
    'essay:whyMichigan',
  );
  const whyMichiganDraft = requireOne(
    await sdb.insert(S.essayDrafts, {
      essayId: whyMichigan.id,
      version: 1,
      content: WHY_MICHIGAN_DRAFT,
      wordCount: wordCount(WHY_MICHIGAN_DRAFT),
      source: 'dashboard_editor',
      createdAt: new Date('2026-09-02T20:00:00Z'),
    }),
    'essayDraft:whyMichigan',
  );
  await sdb.update(S.essays, { currentDraftId: whyMichiganDraft.id }, eq(S.essays.id, whyMichigan.id));
  await sdb.update(S.applicationItems, { essayId: whyMichigan.id }, eq(S.applicationItems.id, whyMichiganItem.id));

  const whyUchicago = requireOne(
    await sdb.insert(S.essays, {
      applicationId: uchicago.id,
      applicationItemId: whyUchicagoItem.id,
      title: 'Why UChicago',
      prompt: supplementPrompt('uchicago', 'why_uchicago'),
      wordLimit: 650,
    }),
    'essay:whyUchicago',
  );
  const whyUchicagoDraft = requireOne(
    await sdb.insert(S.essayDrafts, {
      essayId: whyUchicago.id,
      version: 1,
      content: WHY_UCHICAGO_DRAFT,
      wordCount: wordCount(WHY_UCHICAGO_DRAFT),
      source: 'dashboard_editor',
      createdAt: new Date('2026-08-25T20:00:00Z'),
    }),
    'essayDraft:whyUchicago',
  );
  await sdb.update(S.essays, { currentDraftId: whyUchicagoDraft.id }, eq(S.essays.id, whyUchicago.id));
  await sdb.update(S.applicationItems, { essayId: whyUchicago.id }, eq(S.applicationItems.id, whyUchicagoItem.id));

  const whyNorthwestern = requireOne(
    await sdb.insert(S.essays, {
      applicationId: northwestern.id,
      applicationItemId: whyNorthwesternItem.id,
      title: 'Why Northwestern',
      prompt: supplementPrompt('northwestern', 'why_northwestern'),
      wordLimit: 300,
    }),
    'essay:whyNorthwestern',
  );
  await sdb.update(S.applicationItems, { essayId: whyNorthwestern.id }, eq(S.applicationItems.id, whyNorthwesternItem.id));

  // ---------- recommenders & assignments ----------
  const park = requireOne(
    await sdb.insert(S.recommenders, {
      name: 'Ms. Park',
      role: 'teacher',
      email: 'park@lincolnhs.example',
      subject: 'AP English Language',
      inviteStatus: 'invited',
      invitedAt: '2026-09-02',
    }),
    'recommender:park',
  );
  const okafor = requireOne(
    await sdb.insert(S.recommenders, {
      name: 'Mr. Okafor',
      role: 'teacher',
      email: 'okafor@lincolnhs.example',
      subject: 'AP Physics',
      inviteStatus: 'submitted',
      invitedAt: '2026-08-28',
    }),
    'recommender:okafor',
  );
  const diaz = requireOne(
    await sdb.insert(S.recommenders, {
      name: 'Mr. Diaz',
      role: 'counselor',
      email: 'diaz@lincolnhs.example',
      subject: null,
      inviteStatus: 'not_invited',
      invitedAt: null,
    }),
    'recommender:diaz',
  );
  const recommenderIdByName = new Map([
    ['Ms. Park', park.id],
    ['Mr. Okafor', okafor.id],
    ['Mr. Diaz', diaz.id],
  ]);

  const commonAppSlugs = APPLICATION_SPECS.filter((s) => SCHOOL_BY_SLUG.get(s.slug)?.common_app_member).map((s) => s.slug);

  type NewRecommenderAssignment = Omit<typeof S.recommenderAssignments.$inferInsert, 'studentId'>;
  const assignmentRows: NewRecommenderAssignment[] = [];
  for (const slug of ['umich', 'northwestern', 'uchicago']) {
    const application = applicationBySlug.get(slug);
    if (!application) throw new Error(`missing application for "${slug}"`);
    assignmentRows.push({ recommenderId: park.id, applicationId: application.id, status: 'invited', invitedAt: '2026-09-02', submittedAt: null });
  }
  for (const slug of ['umich', 'uchicago']) {
    const application = applicationBySlug.get(slug);
    if (!application) throw new Error(`missing application for "${slug}"`);
    assignmentRows.push({ recommenderId: okafor.id, applicationId: application.id, status: 'submitted', invitedAt: '2026-08-28', submittedAt: '2026-09-01' });
  }
  for (const slug of commonAppSlugs) {
    const application = applicationBySlug.get(slug);
    if (!application) throw new Error(`missing application for "${slug}"`);
    assignmentRows.push({ recommenderId: diaz.id, applicationId: application.id, status: 'pending', invitedAt: null, submittedAt: null });
  }
  await sdb.insert(S.recommenderAssignments, assignmentRows);

  // ---------- link recommenderId onto the matching application items ----------
  for (const slug of commonAppSlugs) {
    const counselorItem = findItem(applicationBySlug.get(slug)!.id, 'counselor_rec');
    await sdb.update(S.applicationItems, { recommenderId: diaz.id }, eq(S.applicationItems.id, counselorItem.id));
  }
  for (const [slug, order] of Object.entries(TEACHER_REC_ORDER)) {
    const application = applicationBySlug.get(slug);
    if (!application) continue;
    order.forEach((name, i) => {
      const recommenderId = recommenderIdByName.get(name);
      if (!recommenderId) return;
      const item = findItem(application.id, `teacher_rec:${i + 1}`);
      void sdb.update(S.applicationItems, { recommenderId }, eq(S.applicationItems.id, item.id));
    });
  }
  // The two required-but-unfilled teacher slots (WashU, Emory, Vanderbilt) stay unassigned.

  // ---------- credentials ----------
  const env = loadEnv();
  const ring = parseKeyRing(env.CREDENTIALS_ENCRYPTION_KEYS, env.CREDENTIALS_ENCRYPTION_KEY_VERSION);
  await credentialsRepo.store(sdb, ring, 'common_app', DEMO_STUDENT.commonAppEmail, DEMO_STUDENT.commonAppPassword);
  await credentialsRepo.markVerified(sdb, 'common_app');

  // ---------- browser jobs & snapshot ----------
  await sdb.insert(S.browserJobs, {
    kind: 'verify_credentials',
    status: 'succeeded',
    provider: 'local',
    result: BrowserJobResult.parse({ pages_visited: ['login'], login_ok: true, notes: 'Credentials verified.' }),
    startedAt: new Date('2026-09-01T14:00:00Z'),
    finishedAt: new Date('2026-09-01T14:01:00Z'),
    createdAt: new Date('2026-09-01T14:00:00Z'),
  });

  const fullSyncJob = requireOne(
    await sdb.insert(S.browserJobs, {
      kind: 'full_sync',
      status: 'succeeded',
      provider: 'local',
      startedAt: new Date('2026-09-03T13:55:00Z'),
      finishedAt: SYNCED_AT,
      createdAt: new Date('2026-09-03T13:55:00Z'),
    }),
    'browserJob:fullSync',
  );

  const snapshotRow = requireOne(
    await sdb.insert(S.commonAppSnapshots, {
      browserJobId: fullSyncJob.id,
      raw: {},
      normalized: snapshot,
      diff: [],
      overallConfidence: '1.000',
      createdAt: SYNCED_AT,
    }),
    'commonAppSnapshot',
  );

  const pagesVisited = [
    'dashboard',
    'my_colleges',
    'ca_profile',
    'ca_family',
    'ca_education',
    'ca_testing',
    'ca_activities',
    'ca_writing',
    'ca_courses_grades',
    ...commonAppSlugs.flatMap((slug) => [
      `college_questions:${slug}`,
      `college_writing_supplement:${slug}`,
      `college_recommenders:${slug}`,
      `college_review_submit:${slug}`,
    ]),
  ];
  await sdb.update(
    S.browserJobs,
    {
      result: BrowserJobResult.parse({
        pages_visited: pagesVisited,
        snapshot_id: snapshotRow.id,
        changes_count: 0,
        verification_requested: false,
        login_ok: true,
        fill_verifications: [],
        low_confidence_sections: [],
        notes: 'Full sync completed; baseline snapshot, no verification code required.',
      }),
    },
    eq(S.browserJobs.id, fullSyncJob.id),
  );

  // ---------- conversation & messages ----------
  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  await sdb.insert(S.messages, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    kind: 'text',
    body: "Hi Dee — I'm Vector. I'll keep an eye on your Common App, track your deadlines, and text you when something needs your attention. Say hi anytime.",
    deliveryStatus: 'delivered',
    createdAt: new Date('2026-09-01T15:05:00Z'),
  });
  const [inboundMessage] = await sdb.insert(S.messages, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'inbound',
    kind: 'text',
    body: 'hey what should i do first',
    deliveryStatus: 'delivered',
    createdAt: new Date('2026-09-02T14:00:00Z'),
  });
  await sdb.insert(S.messages, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    kind: 'text',
    body:
      "Three things I'd knock out first: 1) Finish the Why Michigan supplement — 143/300 words, EA is due Nov 1. " +
      "2) Nudge Ms. Park for the Northwestern letter — she was invited Sep 2. 3) File the FAFSA the day it opens Oct 1, since a few schools want it early for aid.",
    deliveryStatus: 'delivered',
    inReplyToId: inboundMessage?.id ?? null,
    createdAt: new Date('2026-09-02T14:02:00Z'),
  });
  const nudgeMessage = requireOne(
    await sdb.insert(S.messages, {
      conversationId: conversation.id,
      channel: 'imessage',
      direction: 'outbound',
      kind: 'text',
      body: "Quick heads up — Ms. Park hasn't submitted your Michigan letter yet; she was invited over a week ago and EA is Nov 1. Want me to draft a reminder you can send her?",
      deliveryStatus: 'delivered',
      proactive: true,
      createdAt: new Date('2026-09-03T13:00:00Z'),
    }),
    'message:nudge',
  );

  // ---------- nudge ----------
  const triggerKey = `recommender_inactivity:${park.id}:${umich.id}:2026-08-31`;
  const [nudgeRow] = await sdb.insert(S.nudges, {
    kind: 'recommender_inactivity',
    triggerKey,
    applicationId: umich.id,
    messageId: nudgeMessage.id,
    sentAt: new Date('2026-09-03T13:00:00Z'),
  });
  if (!nudgeRow) throw new Error('nudge insert failed');
  await sdb.update(S.nudges, { acknowledgedAt: new Date('2026-09-03T15:00:00Z') }, eq(S.nudges.id, nudgeRow.id));

  // ---------- next actions ----------
  const prioritizeApplications: PrioritizeApplication[] = APPLICATION_SPECS.map((spec) => {
    const application = applicationBySlug.get(spec.slug);
    const datasetEntry = SCHOOL_BY_SLUG.get(spec.slug);
    if (!application || !datasetEntry) throw new Error(`missing setup for "${spec.slug}"`);
    return { id: application.id, schoolName: datasetEntry.name, plan: spec.plan, deadline: application.deadline, status: spec.status };
  });
  const applicationNameById = new Map(prioritizeApplications.map((a) => [a.id, a.schoolName]));
  const prioritizeItems: PrioritizeItem[] = allItems.map((item) => ({
    id: item.id,
    applicationId: item.applicationId,
    schoolName: item.applicationId ? (applicationNameById.get(item.applicationId) ?? null) : null,
    ruleKey: item.ruleKey,
    kind: item.kind,
    title: item.title,
    status: item.status,
    dueDate: item.dueDate,
    importance: item.importance,
    effort: item.effort,
    dependsOnOthers: item.dependsOnOthers,
    blocking: item.blocking,
    notes: item.notes,
    evidenceText: item.evidence?.text ?? null,
  }));
  const nextActionSpecs = computeNextActions({ today: TODAY, items: prioritizeItems, applications: prioritizeApplications, nudgeIntensity: 'normal' });
  if (nextActionSpecs.length > 0) {
    await sdb.insert(
      S.nextActions,
      nextActionSpecs.map((spec) => ({
        applicationItemId: spec.applicationItemId,
        applicationId: spec.applicationId,
        action: spec.action,
        reason: spec.reason,
        priorityScore: spec.priorityScore.toFixed(3),
        rank: spec.rank,
        dueDate: spec.dueDate,
        status: 'open' as const,
      })),
    );
  }

  // ---------- audit log ----------
  await appendAudit(sdb, {
    actor: 'system',
    action: 'seed.demo_student',
    entityType: 'student',
    entityId: student.id,
    details: { source: 'docs/DEMO_STUDENT.md' },
  });
  await appendAudit(sdb, {
    actor: 'system',
    action: 'sync.completed',
    entityType: 'browser_job',
    entityId: fullSyncJob.id,
    details: { changesCount: 0, snapshotId: snapshotRow.id },
  });
  await appendAudit(sdb, {
    actor: 'system',
    action: 'message.sent',
    entityType: 'message',
    entityId: nudgeMessage.id,
    details: { kind: 'recommender_inactivity', proactive: true },
  });

  return { studentId: student.id, adminId: admin.id };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const handle = createDb(env.DATABASE_URL, { max: 2 });
  try {
    const result = await seedDemoStudent(handle.db);
    process.stdout.write(`seeded demo student ${result.studentId} (admin ${result.adminId})\n`);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
