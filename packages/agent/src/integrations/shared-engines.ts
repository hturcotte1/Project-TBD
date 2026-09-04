/**
 * Isolated integration point for the requirements engine and the trigger/nudge-phrasing rules
 * (`@tbd/shared/requirements` and `@tbd/shared/proactive`). Both packages are being built
 * concurrently by other agents; as of this writing their `index.ts` files are still empty
 * placeholders (`export {}` — see `packages/shared/src/requirements/index.ts` and
 * `packages/shared/src/proactive/index.ts`).
 *
 * This file implements the documented contracts (`findSchool`, `SCHOOL_BY_SLUG`,
 * `resolveDeadline`, `buildChecklist`, `templateForTrigger`, `factsMentioned`) against a small
 * real dataset (the twelve schools in `docs/DEMO_STUDENT.md`) so every tool and runtime that
 * needs them works today, end to end, against real data shapes. It is the ONLY file in
 * `@tbd/agent` that knows these engines don't exist upstream yet — every tool/runtime imports
 * from here, never from `@tbd/shared/requirements` or `@tbd/shared/proactive` directly.
 *
 * TO WIRE THE REAL ENGINES: once `@tbd/shared/requirements` and `@tbd/shared/proactive` export
 * these names for real, replace the bodies below with re-exports from those subpaths (or delete
 * this file and repoint the ~6 call sites that import from `../integrations/shared-engines`).
 * The exported signatures here already match what the orchestrator documented, so no caller
 * should need to change.
 */
import type {
  ApplicationPlan,
  EffortLevel,
  ItemKind,
  ItemSource,
  NudgeKind,
} from '@tbd/shared/domain';
import type { IsoDate, SchoolRequirementsData, TriggerEvent } from '@tbd/shared/schemas';

export interface SchoolDatasetEntry {
  slug: string;
  name: string;
  ceeb_code: string | null;
  common_app_member: boolean;
  portal_url: string | null;
  website: string | null;
  city: string;
  state: string;
  type: 'public' | 'private';
  aliases: string[];
  requirements: SchoolRequirementsData;
}

const CYCLE = '2026-27';

function reqs(input: {
  plans: SchoolRequirementsData['plans'];
  supplements?: SchoolRequirementsData['supplements'];
  teacherMin?: number;
  counselorRequired?: boolean;
  interviewPolicy?: SchoolRequirementsData['interview_policy'];
  needsVerification?: boolean;
}): SchoolRequirementsData {
  return {
    cycle: CYCLE,
    plans: input.plans,
    supplements: input.supplements ?? [],
    recommendations: {
      teacher_min: input.teacherMin ?? 1,
      teacher_max: Math.max(input.teacherMin ?? 1, 2),
      counselor_required: input.counselorRequired ?? true,
      other_max: 1,
      notes: '',
    },
    test_policy: 'optional',
    interview_policy: input.interviewPolicy ?? 'none',
    portfolio: { status: 'none', description: '' },
    midyear_report: true,
    css_profile: { required: false, deadline: null, needs_verification: false },
    fafsa_priority_deadline: null,
    application_fee: 75,
    fee_waiver_eligible: true,
    needs_verification: input.needsVerification ?? false,
    source: 'internal_dataset',
    notes: '',
  };
}

function school(entry: Omit<SchoolDatasetEntry, 'requirements'> & { requirements: SchoolRequirementsData }): SchoolDatasetEntry {
  return entry;
}

/** The dataset backing `findSchool`/`SCHOOL_BY_SLUG`: the twelve schools in docs/DEMO_STUDENT.md. */
export const SCHOOL_BY_SLUG: Record<string, SchoolDatasetEntry> = {
  umich: school({
    slug: 'umich',
    name: 'University of Michigan',
    ceeb_code: '1839',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://umich.edu',
    city: 'Ann Arbor',
    state: 'MI',
    type: 'public',
    aliases: ['Michigan', 'UMich', 'U of M'],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [
        { id: 'why_michigan', title: 'Why Michigan', prompt: 'Why does UM appeal to you?', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false },
        { id: 'community_essay', title: 'Community essay', prompt: 'Describe a community you belong to.', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false },
      ],
      teacherMin: 2,
    }),
  }),
  northwestern: school({
    slug: 'northwestern',
    name: 'Northwestern University',
    ceeb_code: '1565',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://northwestern.edu',
    city: 'Evanston',
    state: 'IL',
    type: 'private',
    aliases: ['NU'],
    requirements: reqs({
      plans: [{ plan: 'ED', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'why_northwestern', title: 'Why Northwestern', prompt: 'Why Northwestern?', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 1,
    }),
  }),
  uchicago: school({
    slug: 'uchicago',
    name: 'University of Chicago',
    ceeb_code: '1832',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://uchicago.edu',
    city: 'Chicago',
    state: 'IL',
    type: 'private',
    aliases: ['UChicago', 'U Chicago', 'Chicago'],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [
        { id: 'why_uchicago', title: 'Why UChicago', prompt: 'Why UChicago?', word_limit: 250, required: true, applies_to_plans: null, needs_verification: false },
        { id: 'extended_essay', title: 'Extended essay', prompt: 'Pick one of the uncommon prompts.', word_limit: 650, required: true, applies_to_plans: null, needs_verification: false },
      ],
      teacherMin: 2,
    }),
  }),
  uiuc: school({
    slug: 'uiuc',
    name: 'University of Illinois Urbana-Champaign',
    ceeb_code: '1836',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://illinois.edu',
    city: 'Urbana-Champaign',
    state: 'IL',
    type: 'public',
    aliases: ['Illinois', 'U of I', 'UIUC'],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'major_essay', title: 'Major essay', prompt: 'Why this major?', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 0,
      counselorRequired: false,
    }),
  }),
  wisconsin: school({
    slug: 'wisconsin',
    name: 'University of Wisconsin–Madison',
    ceeb_code: '1846',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://wisc.edu',
    city: 'Madison',
    state: 'WI',
    type: 'public',
    aliases: ['UW-Madison', 'UW Madison', 'Madison'],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'why_wisconsin', title: 'Why Wisconsin', prompt: 'Why Wisconsin?', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 0,
      counselorRequired: false,
    }),
  }),
  purdue: school({
    slug: 'purdue',
    name: 'Purdue University',
    ceeb_code: '1631',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://purdue.edu',
    city: 'West Lafayette',
    state: 'IN',
    type: 'public',
    aliases: [],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'purdue_short_answers', title: 'Purdue short answers', prompt: 'Short answers about your program.', word_limit: 200, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 0,
      counselorRequired: false,
    }),
  }),
  indiana: school({
    slug: 'indiana',
    name: 'Indiana University Bloomington',
    ceeb_code: '1324',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://indiana.edu',
    city: 'Bloomington',
    state: 'IN',
    type: 'public',
    aliases: ['IU', 'IU Bloomington'],
    requirements: reqs({
      plans: [{ plan: 'EA', deadline: '2026-11-01', notes: '', needs_verification: false }],
      teacherMin: 0,
      counselorRequired: false,
    }),
  }),
  georgetown: school({
    slug: 'georgetown',
    name: 'Georgetown University',
    ceeb_code: '5244',
    common_app_member: false,
    portal_url: 'https://apply.georgetown.edu',
    website: 'https://georgetown.edu',
    city: 'Washington',
    state: 'DC',
    type: 'private',
    aliases: [],
    requirements: reqs({
      plans: [{ plan: 'RD', deadline: '2027-01-10', notes: 'Georgetown uses its own application, not Common App.', needs_verification: false }],
      teacherMin: 2,
      interviewPolicy: 'recommended',
    }),
  }),
  washu: school({
    slug: 'washu',
    name: 'Washington University in St. Louis',
    ceeb_code: '6929',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://wustl.edu',
    city: 'St. Louis',
    state: 'MO',
    type: 'private',
    aliases: ['WashU'],
    requirements: reqs({
      plans: [{ plan: 'RD', deadline: '2027-01-02', notes: '', needs_verification: false }],
      supplements: [{ id: 'why_washu', title: 'Why WashU (optional)', prompt: 'Why WashU?', word_limit: 250, required: false, applies_to_plans: null, needs_verification: false }],
      teacherMin: 1,
    }),
  }),
  emory: school({
    slug: 'emory',
    name: 'Emory University',
    ceeb_code: '5187',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://emory.edu',
    city: 'Atlanta',
    state: 'GA',
    type: 'private',
    aliases: [],
    requirements: reqs({
      plans: [{ plan: 'RD', deadline: '2027-01-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'emory_short_answers', title: 'Emory short answers', prompt: 'Short answers.', word_limit: 150, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 1,
    }),
  }),
  vanderbilt: school({
    slug: 'vanderbilt',
    name: 'Vanderbilt University',
    ceeb_code: '1871',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://vanderbilt.edu',
    city: 'Nashville',
    state: 'TN',
    type: 'private',
    aliases: ['Vandy'],
    requirements: reqs({
      plans: [{ plan: 'RD', deadline: '2027-01-01', notes: '', needs_verification: false }],
      supplements: [{ id: 'vanderbilt_short_answer', title: 'Vanderbilt short answer', prompt: 'Short answer.', word_limit: 200, required: true, applies_to_plans: null, needs_verification: false }],
      teacherMin: 1,
    }),
  }),
  'loyola-chicago': school({
    slug: 'loyola-chicago',
    name: 'Loyola University Chicago',
    ceeb_code: '1699',
    common_app_member: true,
    portal_url: 'https://apply.commonapp.org',
    website: 'https://luc.edu',
    city: 'Chicago',
    state: 'IL',
    type: 'private',
    aliases: ['Loyola', 'Loyola Chicago'],
    requirements: reqs({
      plans: [{ plan: 'rolling', deadline: '2026-12-01', notes: 'Priority deadline.', needs_verification: false }],
      teacherMin: 0,
      counselorRequired: false,
    }),
  }),
};

/** Case-insensitive lookup by slug, exact name, alias, or substring against name/aliases. */
export function findSchool(query: string): SchoolDatasetEntry | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const direct = SCHOOL_BY_SLUG[q];
  if (direct) return direct;
  const all = Object.values(SCHOOL_BY_SLUG);
  const bySlug = all.find((s) => s.slug.toLowerCase() === q);
  if (bySlug) return bySlug;
  const byName = all.find((s) => s.name.toLowerCase() === q);
  if (byName) return byName;
  const byAlias = all.find((s) => s.aliases.some((a) => a.toLowerCase() === q));
  if (byAlias) return byAlias;
  const contains = all.find(
    (s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()) || s.aliases.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase())),
  );
  return contains ?? null;
}

/** The plan requirement matching `plan`, resolved to a deadline date + verification flag. */
export function resolveDeadline(requirements: SchoolRequirementsData, plan: ApplicationPlan): { deadline: IsoDate; needsVerification: boolean } | null {
  const match = requirements.plans.find((p) => p.plan === plan);
  if (!match) return null;
  return { deadline: match.deadline, needsVerification: match.needs_verification || requirements.needs_verification };
}

export interface ChecklistItemDraft {
  ruleKey: string;
  kind: ItemKind;
  title: string;
  description: string;
  source: ItemSource;
  dueDate: IsoDate | null;
  importance: number;
  effort: EffortLevel;
  dependsOnOthers: boolean;
  blocking: boolean;
}

/** Builds the application-item checklist for one school/plan from its requirements data. */
export function buildChecklist(requirements: SchoolRequirementsData, plan: ApplicationPlan): ChecklistItemDraft[] {
  const resolved = resolveDeadline(requirements, plan);
  const deadline = resolved?.deadline ?? null;
  const items: ChecklistItemDraft[] = [];

  items.push({
    ruleKey: 'college_questions',
    kind: 'college_questions',
    title: 'College-specific questions',
    description: '',
    source: 'internal_rule',
    dueDate: deadline,
    importance: 70,
    effort: 'medium',
    dependsOnOthers: false,
    blocking: false,
  });

  for (const supp of requirements.supplements) {
    if (supp.applies_to_plans && !supp.applies_to_plans.includes(plan)) continue;
    items.push({
      ruleKey: `supplement:${supp.id}`,
      kind: 'supplement_essay',
      title: supp.title,
      description: supp.prompt,
      source: 'internal_rule',
      dueDate: deadline,
      importance: supp.required ? 80 : 40,
      effort: 'large',
      dependsOnOthers: false,
      blocking: supp.required,
    });
  }

  items.push({
    ruleKey: 'ferpa',
    kind: 'ferpa',
    title: 'FERPA release',
    description: '',
    source: 'internal_rule',
    dueDate: deadline,
    importance: 60,
    effort: 'small',
    dependsOnOthers: false,
    blocking: false,
  });

  for (let i = 1; i <= requirements.recommendations.teacher_min; i++) {
    items.push({
      ruleKey: `teacher_rec:${i}`,
      kind: 'teacher_rec',
      title: `Teacher recommendation ${i}`,
      description: '',
      source: 'internal_rule',
      dueDate: deadline,
      importance: 75,
      effort: 'small',
      dependsOnOthers: true,
      blocking: true,
    });
  }

  if (requirements.recommendations.counselor_required) {
    items.push({
      ruleKey: 'counselor_rec',
      kind: 'counselor_rec',
      title: 'Counselor recommendation',
      description: '',
      source: 'internal_rule',
      dueDate: deadline,
      importance: 75,
      effort: 'small',
      dependsOnOthers: true,
      blocking: true,
    });
  }

  if (requirements.portfolio.status === 'required' || requirements.portfolio.status === 'required_for_majors') {
    items.push({
      ruleKey: 'portfolio',
      kind: 'portfolio',
      title: 'Portfolio',
      description: requirements.portfolio.description,
      source: 'internal_rule',
      dueDate: deadline,
      importance: 65,
      effort: 'large',
      dependsOnOthers: false,
      blocking: false,
    });
  }

  if (requirements.interview_policy === 'required' || requirements.interview_policy === 'by_invitation' || requirements.interview_policy === 'recommended') {
    items.push({
      ruleKey: 'interview',
      kind: 'interview',
      title: 'Interview',
      description: '',
      source: 'internal_rule',
      dueDate: null,
      importance: 50,
      effort: 'medium',
      dependsOnOthers: true,
      blocking: false,
    });
  }

  if (requirements.css_profile.required) {
    items.push({
      ruleKey: 'css_profile',
      kind: 'css_profile',
      title: 'CSS Profile',
      description: '',
      source: 'internal_rule',
      dueDate: requirements.css_profile.deadline ?? deadline,
      importance: 55,
      effort: 'medium',
      dependsOnOthers: false,
      blocking: false,
    });
  }

  items.push({
    ruleKey: 'application_fee',
    kind: requirements.fee_waiver_eligible ? 'fee_waiver' : 'application_fee',
    title: requirements.fee_waiver_eligible ? 'Fee waiver' : 'Application fee',
    description: '',
    source: 'internal_rule',
    dueDate: deadline,
    importance: 45,
    effort: 'small',
    dependsOnOthers: false,
    blocking: false,
  });

  items.push({
    ruleKey: 'review_submit',
    kind: 'review_submit',
    title: 'Review and submit',
    description: '',
    source: 'internal_rule',
    dueDate: deadline,
    importance: 95,
    effort: 'small',
    dependsOnOthers: false,
    blocking: true,
  });

  return items;
}

function factToString(v: string | number | boolean | null): string {
  return v === null ? '' : String(v);
}

/** True when every non-empty fact value in `t.facts` appears (case-insensitively) in `text`. */
export function factsMentioned(text: string, t: TriggerEvent): boolean {
  const hay = text.toLowerCase();
  return Object.values(t.facts).every((v) => {
    if (v === null || v === '') return true;
    return hay.includes(factToString(v).toLowerCase());
  });
}

const KIND_PHRASING: Record<NudgeKind, (t: TriggerEvent) => string> = {
  deadline_countdown: (t) => {
    const school = t.facts.school_name ?? 'This application';
    const days = t.days_remaining ?? t.facts.days_remaining;
    return `${school}'s deadline is in ${days} day${days === 1 ? '' : 's'}${t.due_date ? ` (${t.due_date})` : ''}.`;
  },
  deadline_day_of: (t) => `${t.facts.school_name ?? 'This application'} is due today${t.due_date ? ` (${t.due_date})` : ''} — let's get it finished.`,
  recommender_inactivity: (t) => {
    const name = t.facts.recommender_name ?? 'Your recommender';
    const school = t.facts.school_name;
    return `${name} hasn't submitted your recommendation yet${school ? ` for ${school}` : ''}.`;
  },
  essay_staleness: (t) => `${t.facts.essay_title ?? 'One of your drafts'} hasn't been touched in a while.`,
  score_send_cutoff: (t) => `The score-send window for ${t.facts.test_name ?? 'a required test'} closes soon.`,
  morning_plan: (t) => `Here's what's worth focusing on today${t.facts.count ? ` (${t.facts.count} things)` : ''}.`,
  weekly_plan: () => "Your plan for the week is ready.",
  sync_change: (t) => `${t.facts.summary ?? 'Something changed'} on Common App.`,
  custom: (t) => String(t.facts.message ?? 'Quick update for you.'),
};

/** Appends any fact value the phrasing didn't naturally include, so the template always self-validates. */
function ensureFactsMentioned(text: string, t: TriggerEvent): string {
  const hay = text.toLowerCase();
  const missing = Object.values(t.facts).filter((v): v is string | number => v !== null && v !== '' && !hay.includes(factToString(v).toLowerCase()));
  return missing.length === 0 ? text : `${text} (${missing.map(factToString).join(', ')})`;
}

/** Deterministic fallback phrasing for a trigger, used when the LLM's phrasing fails validation. */
export function templateForTrigger(t: TriggerEvent): string {
  const phrase = KIND_PHRASING[t.kind](t);
  return ensureFactsMentioned(phrase, t);
}
