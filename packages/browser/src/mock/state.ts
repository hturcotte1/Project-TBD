import { z } from 'zod';
import { ACTIVITY_TIMINGS, ACTIVITY_TYPES, APPLICATION_PLANS, GRADE_LEVELS } from '@apogee/shared/domain';

/**
 * In-memory state for the mock Common App. Deliberately its own schema (not `CommonAppSnapshot`):
 * the mock needs server-side-only fields (passwords, recommender emails, form text) that a real
 * extraction would never see, and it needs to represent the site *before* extraction, not after.
 */

export const SectionStatus = z.enum(['complete', 'in_progress', 'not_started']);
export type SectionStatus = z.infer<typeof SectionStatus>;

export const MockActivityEntry = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  position: z.string().max(50),
  organization: z.string().max(100),
  description: z.string().max(150),
  grade_levels: z.array(z.enum(GRADE_LEVELS)).min(1),
  timing: z.array(z.enum(ACTIVITY_TIMINGS)).min(1),
  hours_per_week: z.number().min(0).max(168),
  weeks_per_year: z.number().int().min(1).max(52),
  continue_in_college: z.boolean(),
});
export type MockActivityEntry = z.infer<typeof MockActivityEntry>;

export const MockRecommender = z.object({
  name: z.string().max(120),
  email: z.string().email(),
  role: z.enum(['teacher', 'counselor', 'other']),
  subject: z.string().max(80).nullable().default(null),
  status: z.enum(['not_invited', 'invited', 'submitted', 'declined']),
  invitedAt: z.string().nullable().default(null),
  submittedAt: z.string().nullable().default(null),
});
export type MockRecommender = z.infer<typeof MockRecommender>;

export const MockSupplement = z.object({
  title: z.string().max(200),
  required: z.boolean().default(true),
  status: SectionStatus,
  wordCount: z.number().int().nonnegative().nullable().default(null),
  text: z.string().default(''),
});
export type MockSupplement = z.infer<typeof MockSupplement>;

export const MockCollege = z.object({
  slug: z.string().max(100),
  name: z.string().max(200),
  plan: z.enum(APPLICATION_PLANS).nullable().default(null),
  deadline: z.string().nullable().default(null),
  questionsStatus: SectionStatus,
  questionsAnswers: z.object({ q_intended_major: z.string().default(''), q_additional_info: z.string().default('') }),
  supplements: z.array(MockSupplement).default([]),
  ferpaStatus: z.enum(['complete', 'incomplete']).default('incomplete'),
  counselor: MockRecommender.nullable().default(null),
  teachers: z.array(MockRecommender).default([]),
  others: z.array(MockRecommender).default([]),
  reviewSubmitStatus: z.enum(['not_ready', 'ready', 'submitted']).default('not_ready'),
  feeStatus: z.enum(['unpaid', 'paid', 'waived', 'not_required']).default('unpaid'),
  feeWaiverEligible: z.boolean().default(false),
  submissionStatus: z.enum(['not_submitted', 'submitted']).default('not_submitted'),
  submittedAt: z.string().nullable().default(null),
});
export type MockCollege = z.infer<typeof MockCollege>;

export const MockAccountState = z.object({
  account: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    /** null = no verification step required at all. */
    verificationCode: z.string().nullable().default(null),
  }),
  maintenance: z.boolean().default(false),
  profile: z.object({
    firstName: z.string().max(80),
    lastName: z.string().max(80),
    preferredName: z.string().max(80).default(''),
  }),
  education: z.object({
    highSchool: z.string().max(200),
    graduationYear: z.number().int().min(2020).max(2035),
    gpaUnweighted: z.number().min(0).max(5).nullable().default(null),
    gpaWeighted: z.number().min(0).max(6).nullable().default(null),
    classRank: z.number().int().positive().nullable().default(null),
  }),
  sections: z.object({
    profile: SectionStatus,
    family: SectionStatus,
    education: SectionStatus,
    testing: SectionStatus,
    activities: SectionStatus,
    coursesGrades: SectionStatus,
  }),
  testing: z.object({
    satTotal: z.number().int().min(400).max(1600).nullable().default(null),
    satEbrw: z.number().int().min(200).max(800).nullable().default(null),
    satMath: z.number().int().min(200).max(800).nullable().default(null),
    satDate: z.string().nullable().default(null),
  }),
  activities: z.array(MockActivityEntry).max(10).default([]),
  writing: z.object({
    status: SectionStatus,
    promptIndex: z.number().int().min(1).max(7),
    wordCount: z.number().int().nonnegative(),
    text: z.string().default(''),
  }),
  colleges: z.array(MockCollege).default([]),
});
export type MockAccountState = z.infer<typeof MockAccountState>;

const TAQUERIA_ESSAY =
  "The griddle at Rosa's Taqueria never fully cools between the lunch and dinner rush, and neither do I. " +
  'I started as the kid who refilled salsa boats; three years later I run the line on Friday nights, ' +
  'calling out ticket times while the radio plays cumbias too loud for the health inspector\'s taste. ' +
  'My mom thinks I took the job to help with rent, and I did, but I stayed for the fifteen minutes before ' +
  'open when the whole crew stands around the pass eating whatever came out wrong, arguing about whether ' +
  'the carnitas needs more orange peel. Restaurant work taught me to read a room in under a second: whose ' +
  'order is about to go sideways, who needs a joke before they snap at the register, when the walk-in cooler ' +
  'compressor is about to give out again. It also taught me that "family business" is not a metaphor. My ' +
  "abuela's recipes are the menu, my tios argue about the books in the back office, and my little brother " +
  'does his homework on an overturned bus tub because there is nowhere else quiet enough. I used to be ' +
  'embarrassed that my after-school job smelled like cumin instead of looking good on a resume next to an ' +
  'internship logo. I am not anymore. Debate taught me to build an argument; the taqueria taught me to read ' +
  'the room the argument is happening in, and to keep the line moving even when the ticket printer jams and ' +
  'the walk-in door sticks and somebody ordered eight tacos with no cilantro, extra cilantro, both, ' +
  'apparently, at once. I want to study public health in college because I have watched, close up, what it ' +
  'costs a family when nobody in the building has a degree that lets them read a lease or a labor law ' +
  'twice. I am not walking away from the taqueria. I am trying to become the person who can finally read ' +
  'the fine print for it, translate the health code binder into something my tios can actually use, and ' +
  'come home on breaks to run the Friday line, because somebody always has to call the ticket times, and I ' +
  "am good at it, and it is, against every odd a college essay is supposed to describe, still the best " +
  'fifteen minutes of my day.';

/** Exactly the account state `docs/DEMO_STUDENT.md` describes, as of 2026-09-04. */
export function defaultMockState(): MockAccountState {
  return {
    account: { email: 'demo@example.com', password: 'demo-password', verificationCode: null },
    maintenance: false,
    profile: { firstName: 'Dee', lastName: 'Demo', preferredName: 'Dee' },
    education: {
      highSchool: 'Lincoln High School',
      graduationYear: 2027,
      gpaUnweighted: 3.82,
      gpaWeighted: 4.31,
      classRank: 41,
    },
    sections: {
      profile: 'complete',
      family: 'complete',
      education: 'in_progress',
      testing: 'complete',
      activities: 'in_progress',
      coursesGrades: 'not_started',
    },
    testing: { satTotal: 1450, satEbrw: 720, satMath: 730, satDate: '2026-06-06' },
    activities: [
      {
        activity_type: 'journalism_publication',
        position: 'Editor-in-Chief',
        organization: 'The Lincoln Log',
        description:
          'Lead a staff of 14 reporters and editors; assign, edit, and lay out every issue of the school ' +
          'paper; run weekly pitch meetings and manage the print budget.',
        grade_levels: ['10', '11', '12'],
        timing: ['school_year'],
        hours_per_week: 8,
        weeks_per_year: 36,
        continue_in_college: true,
      },
      {
        activity_type: 'music_instrumental',
        position: 'Lead Trumpet',
        organization: 'Jazz Band',
        description: 'First-chair trumpet; solo features at winter and spring concerts and two regional festivals.',
        grade_levels: ['9', '10', '11', '12'],
        timing: ['all_year'],
        hours_per_week: 5,
        weeks_per_year: 40,
        continue_in_college: true,
      },
      {
        activity_type: 'work_paid',
        position: 'Line Cook',
        organization: "Rosa's Taqueria",
        description: 'Run the line during dinner rush at my family\'s restaurant; train new cooks; manage inventory.',
        grade_levels: ['11', '12'],
        timing: ['all_year'],
        hours_per_week: 12,
        weeks_per_year: 48,
        continue_in_college: false,
      },
      {
        activity_type: 'community_service',
        position: 'Tutor',
        organization: 'Boys & Girls Club',
        description: 'Weekly reading and math tutoring for 3rd-5th graders; built a lending library for the site.',
        grade_levels: ['10', '11', '12'],
        timing: ['school_year'],
        hours_per_week: 3,
        weeks_per_year: 30,
        continue_in_college: true,
      },
      {
        activity_type: 'family_responsibilities',
        position: 'Caregiver',
        organization: 'Family',
        description: 'After-school and evening childcare for two younger siblings while parents work.',
        grade_levels: ['9', '10', '11', '12'],
        timing: ['all_year'],
        hours_per_week: 10,
        weeks_per_year: 50,
        continue_in_college: false,
      },
      {
        activity_type: 'debate_speech',
        position: 'Varsity Debater',
        organization: 'Lincoln Debate',
        description: 'Varsity policy debate; qualified for state tournament junior year; mentor novice debaters.',
        grade_levels: ['9', '10', '11'],
        timing: ['school_year'],
        hours_per_week: 6,
        weeks_per_year: 28,
        continue_in_college: true,
      },
    ],
    writing: { status: 'in_progress', promptIndex: 5, wordCount: 412, text: TAQUERIA_ESSAY },
    colleges: [
      {
        slug: 'umich',
        name: 'University of Michigan',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'in_progress',
        questionsAnswers: { q_intended_major: 'undecided', q_additional_info: '' },
        supplements: [
          { title: 'Community essay', required: true, status: 'complete', wordCount: 298, text: 'Placeholder community essay draft.' },
          { title: 'Why Michigan', required: true, status: 'in_progress', wordCount: 143, text: 'Placeholder Why Michigan draft.' },
        ],
        ferpaStatus: 'complete',
        counselor: {
          name: 'Mr. Diaz',
          email: 'diaz@lincolnhs.example',
          role: 'counselor',
          subject: null,
          status: 'invited',
          invitedAt: '2026-09-01',
          submittedAt: null,
        },
        teachers: [
          {
            name: 'Ms. Park',
            email: 'park@lincolnhs.example',
            role: 'teacher',
            subject: 'AP English Language',
            status: 'invited',
            invitedAt: '2026-09-02',
            submittedAt: null,
          },
          {
            name: 'Mr. Okafor',
            email: 'okafor@lincolnhs.example',
            role: 'teacher',
            subject: 'AP Physics',
            status: 'submitted',
            invitedAt: '2026-08-28',
            submittedAt: '2026-09-01',
          },
        ],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'northwestern',
        name: 'Northwestern University',
        plan: 'ED',
        deadline: '2026-11-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Why Northwestern', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [
          {
            name: 'Ms. Park',
            email: 'park@lincolnhs.example',
            role: 'teacher',
            subject: 'AP English Language',
            status: 'invited',
            invitedAt: '2026-09-02',
            submittedAt: null,
          },
        ],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'uchicago',
        name: 'University of Chicago',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'complete',
        questionsAnswers: { q_intended_major: 'economics', q_additional_info: '' },
        supplements: [
          { title: 'Why UChicago', required: true, status: 'in_progress', wordCount: 102, text: 'Placeholder Why UChicago draft.' },
          { title: 'Extended essay', required: true, status: 'not_started', wordCount: null, text: '' },
        ],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [
          {
            name: 'Ms. Park',
            email: 'park@lincolnhs.example',
            role: 'teacher',
            subject: 'AP English Language',
            status: 'invited',
            invitedAt: '2026-09-02',
            submittedAt: null,
          },
          {
            name: 'Mr. Okafor',
            email: 'okafor@lincolnhs.example',
            role: 'teacher',
            subject: 'AP Physics',
            status: 'submitted',
            invitedAt: '2026-08-28',
            submittedAt: '2026-09-01',
          },
        ],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'uiuc',
        name: 'University of Illinois Urbana-Champaign',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Major essay', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'wisconsin',
        name: 'University of Wisconsin–Madison',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Why Wisconsin', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'purdue',
        name: 'Purdue University',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Purdue short answers', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'indiana',
        name: 'Indiana University Bloomington',
        plan: 'EA',
        deadline: '2026-11-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'washu',
        name: 'Washington University in St. Louis',
        plan: 'RD',
        deadline: '2027-01-02',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Why WashU (optional)', required: false, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'emory',
        name: 'Emory University',
        plan: 'RD',
        deadline: '2027-01-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Emory short answers', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'vanderbilt',
        name: 'Vanderbilt University',
        plan: 'RD',
        deadline: '2027-01-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [{ title: 'Vanderbilt short answer', required: true, status: 'not_started', wordCount: null, text: '' }],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
      {
        slug: 'loyola-chicago',
        name: 'Loyola University Chicago',
        plan: 'rolling',
        deadline: '2026-12-01',
        questionsStatus: 'not_started',
        questionsAnswers: { q_intended_major: '', q_additional_info: '' },
        supplements: [],
        ferpaStatus: 'complete',
        counselor: null,
        teachers: [],
        others: [],
        reviewSubmitStatus: 'not_ready',
        feeStatus: 'unpaid',
        feeWaiverEligible: true,
        submissionStatus: 'not_submitted',
        submittedAt: null,
      },
    ],
  };
}
