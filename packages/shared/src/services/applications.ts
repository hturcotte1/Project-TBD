/**
 * Application lifecycle: adding a school (known dataset slug or free-text name), deleting an
 * application, changing plan (re-resolving the deadline and rebuilding rule items), and ensuring
 * the student-wide checklist items (FAFSA, Common App sections, personal essay) exist. This is
 * the one place that creates `applications`/`application_items` rows so the API, the onboarding
 * flow, and the agent's `addApplication` tool all go through the same logic.
 */
import { randomUUID } from 'node:crypto';
import { desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import * as S from '../db/schema';
import { AuthorizationError } from '../db/repos/scoped';
import type { StudentDb } from '../db/repos/scoped';
import type { DbOrTx } from '../db/client';
import type { ApplicationPlan, SelfAssessment } from '../domain/enums';
import type { JobEnqueuer } from '../jobs/definitions';
import {
  buildChecklist,
  buildStudentWideChecklist,
  cssProfileDueDate,
  findSchool,
  reconcile,
  resolveDeadline,
  SCHOOL_BY_SLUG,
} from '../requirements';
import type { ChecklistApplication, ChecklistInput, ChecklistItemSpec, ChecklistStudent, StudentWideChecklistInput } from '../requirements';
import type { IsoDate } from '../schemas/common';
import type { SchoolRequirementsData } from '../schemas/requirements';

/** Thrown when the student already has an application for the resolved school. */
export class DuplicateApplicationError extends Error {
  constructor(public readonly schoolName: string) {
    super(`${schoolName} is already on the student's list`);
    this.name = 'DuplicateApplicationError';
  }
}

/** Thrown when neither a school slug nor a school name was given. */
export class InvalidSchoolInputError extends Error {
  constructor() {
    super('school_slug or school_name is required');
    this.name = 'InvalidSchoolInputError';
  }
}

const UNVERIFIED_CYCLE = '2026-27';

/** A reasonable placeholder deadline by plan shape, used only until a real one is verified. */
function placeholderDeadline(plan: ApplicationPlan): IsoDate {
  switch (plan) {
    case 'ED':
    case 'ED2':
    case 'EA':
    case 'REA':
      return '2026-11-01';
    case 'rolling':
      return '2026-12-01';
    case 'RD':
      return '2027-01-01';
  }
}

function unverifiedRequirements(plan: ApplicationPlan): SchoolRequirementsData {
  return {
    cycle: UNVERIFIED_CYCLE,
    plans: [{ plan, deadline: placeholderDeadline(plan), notes: 'Placeholder deadline — not yet verified.', needs_verification: true }],
    supplements: [],
    recommendations: { teacher_min: 1, teacher_max: 2, counselor_required: true, other_max: 0, notes: '' },
    test_policy: 'optional',
    interview_policy: 'none',
    portfolio: { status: 'none', description: '' },
    midyear_report: true,
    css_profile: { required: false, deadline: null, needs_verification: false },
    fafsa_priority_deadline: null,
    application_fee: null,
    fee_waiver_eligible: true,
    needs_verification: true,
    source: 'student',
    notes: 'Added by the student; requirements not yet verified.',
  };
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return s || `school-${randomUUID().slice(0, 8)}`;
}

async function uniqueSlug(db: DbOrTx, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // Small, bounded loop: collisions are rare (student-typed free-text names).
  for (;;) {
    const existing = await db.select({ id: S.schools.id }).from(S.schools).where(eq(S.schools.slug, candidate)).limit(1);
    if (existing.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

/** Case-insensitive match on the school's name or any of its aliases, for reuse across students. */
async function findExistingCustomSchool(db: DbOrTx, name: string): Promise<S.School | null> {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const rows = await db
    .select()
    .from(S.schools)
    .where(
      sql`lower(${S.schools.name}) = ${lower} or exists (select 1 from jsonb_array_elements_text(${S.schools.aliases}) as alias where lower(alias) = ${lower})`,
    )
    .limit(1);
  return rows[0] ?? null;
}

interface ResolvedSchool {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  commonAppMember: boolean;
  requirements: SchoolRequirementsData;
  deadlineSource: string;
}

async function resolveSchool(db: DbOrTx, input: { schoolSlug?: string; schoolName?: string }, plan: ApplicationPlan): Promise<ResolvedSchool> {
  const query = (input.schoolSlug ?? input.schoolName ?? '').trim();
  if (!query) throw new InvalidSchoolInputError();

  const entry = SCHOOL_BY_SLUG.get(query) ?? findSchool(query);
  if (entry) {
    const existing = await db.select().from(S.schools).where(eq(S.schools.slug, entry.slug)).limit(1);
    let row = existing[0];
    if (!row) {
      const [created] = await db
        .insert(S.schools)
        .values({
          slug: entry.slug,
          name: entry.name,
          ceebCode: entry.ceeb_code,
          commonAppMember: entry.common_app_member,
          portalUrl: entry.portal_url,
          website: entry.website,
          city: entry.city,
          state: entry.state,
          type: entry.type,
          aliases: entry.aliases,
        })
        .returning();
      row = created;
    }
    if (!row) throw new Error('failed to create school row');
    const existingReq = await db
      .select()
      .from(S.schoolRequirements)
      .where(sql`${S.schoolRequirements.schoolId} = ${row.id} and ${S.schoolRequirements.cycle} = ${entry.requirements.cycle}`)
      .limit(1);
    if (!existingReq[0]) {
      await db
        .insert(S.schoolRequirements)
        .values({ schoolId: row.id, cycle: entry.requirements.cycle, data: entry.requirements, needsVerification: entry.requirements.needs_verification })
        .onConflictDoNothing();
    }
    return {
      schoolId: row.id,
      schoolName: row.name,
      schoolSlug: row.slug,
      commonAppMember: row.commonAppMember,
      requirements: entry.requirements,
      deadlineSource: 'internal_dataset',
    };
  }

  // Free-text: the school is not in the internal dataset. Reuse an existing custom school row
  // (by name or alias) if another student already added it, else create one with placeholder
  // requirements flagged needs_verification.
  const name = (input.schoolName ?? input.schoolSlug ?? query).trim();
  const existingCustom = await findExistingCustomSchool(db, name);
  if (existingCustom) {
    const reqRows = await db
      .select()
      .from(S.schoolRequirements)
      .where(eq(S.schoolRequirements.schoolId, existingCustom.id))
      .orderBy(S.schoolRequirements.updatedAt);
    const reqRow = reqRows[reqRows.length - 1];
    const requirements = reqRow?.data ?? unverifiedRequirements(plan);
    if (!reqRow) {
      await db.insert(S.schoolRequirements).values({ schoolId: existingCustom.id, cycle: requirements.cycle, data: requirements, needsVerification: true }).onConflictDoNothing();
    }
    return {
      schoolId: existingCustom.id,
      schoolName: existingCustom.name,
      schoolSlug: existingCustom.slug,
      commonAppMember: existingCustom.commonAppMember,
      requirements,
      deadlineSource: 'student',
    };
  }

  const slug = await uniqueSlug(db, slugify(name));
  const requirements = unverifiedRequirements(plan);
  const [created] = await db
    .insert(S.schools)
    .values({ slug, name, commonAppMember: true, city: '', state: '', type: 'private', aliases: [] })
    .returning();
  if (!created) throw new Error('failed to create school row');
  await db.insert(S.schoolRequirements).values({ schoolId: created.id, cycle: requirements.cycle, data: requirements, needsVerification: true });
  return {
    schoolId: created.id,
    schoolName: created.name,
    schoolSlug: created.slug,
    commonAppMember: created.commonAppMember,
    requirements,
    deadlineSource: 'student',
  };
}

function resolvePlanAndDeadline(requirements: SchoolRequirementsData, requestedPlan: ApplicationPlan): { plan: ApplicationPlan; deadline: IsoDate } {
  const offered = requirements.plans.some((p) => p.plan === requestedPlan);
  const plan = offered ? requestedPlan : (requirements.plans[0]?.plan ?? requestedPlan);
  const resolved = resolveDeadline(requirements, plan);
  return { plan, deadline: resolved?.deadline ?? placeholderDeadline(plan) };
}

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
    completedAt: spec.status === 'done' ? new Date() : null,
  };
}

export interface CreateApplicationInput {
  schoolSlug?: string;
  schoolName?: string;
  plan: ApplicationPlan;
  selfAssessment: SelfAssessment | null;
}

export interface CreateApplicationContext {
  today: IsoDate;
  student: ChecklistStudent;
  enqueuer?: JobEnqueuer;
}

/**
 * Adds a school to the student's list: resolves (or creates) the `schools`/`school_requirements`
 * rows, resolves the deadline for the requested plan, inserts the `applications` row, and builds
 * its initial checklist (no Common App snapshot yet, so every Common App-backed item starts
 * `missing` until the first sync reconciles it against reality).
 */
export async function createApplication(db: DbOrTx, sdb: StudentDb, input: CreateApplicationInput, ctx: CreateApplicationContext): Promise<S.Application> {
  const resolvedSchool = await resolveSchool(db, input, input.plan);
  const existingApp = await sdb.selectOne(S.applications, eq(S.applications.schoolId, resolvedSchool.schoolId));
  if (existingApp) throw new DuplicateApplicationError(resolvedSchool.schoolName);

  const { plan, deadline } = resolvePlanAndDeadline(resolvedSchool.requirements, input.plan);

  const [application] = await sdb.insert(S.applications, {
    schoolId: resolvedSchool.schoolId,
    plan,
    deadline,
    deadlineSource: resolvedSchool.deadlineSource,
    status: 'not_started',
    selfAssessment: input.selfAssessment,
    commonAppCollegeId: resolvedSchool.commonAppMember ? resolvedSchool.schoolSlug : null,
  });
  if (!application) throw new Error('failed to create application');

  const checklistApplication: ChecklistApplication = {
    id: application.id,
    plan,
    deadline,
    schoolSlug: resolvedSchool.schoolSlug,
    schoolName: resolvedSchool.schoolName,
    commonAppMember: resolvedSchool.commonAppMember,
    status: 'not_started',
  };
  const checklistInput: ChecklistInput = {
    application: checklistApplication,
    requirements: resolvedSchool.requirements,
    snapshotCollege: null,
    sections: null,
    student: ctx.student,
    today: ctx.today,
    capturedAt: null,
  };
  const specs = buildChecklist(checklistInput);
  if (specs.length > 0) {
    await sdb.insert(
      S.applicationItems,
      specs.map((s) => toItemValues(application.id, s)),
    );
  }

  if (ctx.enqueuer) {
    await ctx.enqueuer.enqueue('maintenance.recompute_next_actions', { studentId: sdb.studentId, reason: 'application_added' });
  }

  return application;
}

export async function deleteApplication(sdb: StudentDb, id: string): Promise<void> {
  const rows = await sdb.delete(S.applications, eq(S.applications.id, id));
  if (rows.length === 0) throw new AuthorizationError();
}

async function loadChecklistStudent(sdb: StudentDb): Promise<ChecklistStudent> {
  const profile = await sdb.selectOne(S.studentProfiles);
  return {
    testStance: profile?.testScores.test_optional_stance ?? 'undecided',
    hasSatOrAct: Boolean(profile && (profile.testScores.sat.length > 0 || profile.testScores.act.length > 0)),
    financialConstraints: profile?.demographics.financial_constraints ?? null,
    firstGeneration: profile?.demographics.first_generation ?? null,
  };
}

/**
 * Changes an application's plan: re-resolves the deadline for the new plan against the school's
 * requirements (falling back to a placeholder if the school doesn't offer it), then rebuilds the
 * rule-sourced checklist items through `reconcile` so student edits survive.
 */
export async function changePlan(sdb: StudentDb, id: string, plan: ApplicationPlan): Promise<S.Application> {
  const application = await sdb.requireOne(S.applications, eq(S.applications.id, id));
  const schoolRows = await sdb.db.select().from(S.schools).where(eq(S.schools.id, application.schoolId)).limit(1);
  const school = schoolRows[0];
  if (!school) throw new Error(`school row missing for application ${id}`);
  const reqRows = await sdb.db
    .select()
    .from(S.schoolRequirements)
    .where(eq(S.schoolRequirements.schoolId, school.id))
    .orderBy(S.schoolRequirements.updatedAt);
  const reqRow = reqRows[reqRows.length - 1];
  const requirements = reqRow?.data ?? unverifiedRequirements(plan);

  const resolved = resolveDeadline(requirements, plan);
  const deadline = resolved?.deadline ?? placeholderDeadline(plan);
  const deadlineSource = resolved ? application.deadlineSource : 'student';

  const [updated] = await sdb.update(S.applications, { plan, deadline, deadlineSource }, eq(S.applications.id, id));
  if (!updated) throw new Error('application update failed');

  const snapshotRows = await sdb.select(S.commonAppSnapshots, undefined, { orderBy: desc(S.commonAppSnapshots.createdAt), limit: 1 });
  const latestSnapshot = snapshotRows[0] ?? null;
  const snapshotCollege = latestSnapshot?.normalized.colleges.find((c) => c.common_app_college_id === school.slug) ?? null;

  const checklistApplication: ChecklistApplication = {
    id: updated.id,
    plan,
    deadline,
    schoolSlug: school.slug,
    schoolName: school.name,
    commonAppMember: school.commonAppMember,
    status: updated.status,
  };
  const student = await loadChecklistStudent(sdb);
  const checklistInput: ChecklistInput = {
    application: checklistApplication,
    requirements,
    snapshotCollege,
    sections: latestSnapshot?.normalized.sections ?? null,
    student,
    today: new Date().toISOString().slice(0, 10),
    capturedAt: latestSnapshot?.normalized.captured_at ?? null,
  };
  const specs = buildChecklist(checklistInput);
  const previousItems = await sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, updated.id));
  const { toInsert, toUpdate, toDelete } = reconcile(previousItems, specs, updated.id);
  if (toInsert.length > 0) await sdb.insert(S.applicationItems, toInsert.map((s) => toItemValues(updated.id, s)));
  for (const u of toUpdate) await sdb.update(S.applicationItems, u.set, eq(S.applicationItems.id, u.id));
  if (toDelete.length > 0) await sdb.delete(S.applicationItems, inArray(S.applicationItems.id, toDelete));

  return updated;
}

export interface EnsureStudentWideItemsContext {
  today: IsoDate;
  student: ChecklistStudent;
  enqueuer?: JobEnqueuer;
}

/** Ensures the student-wide checklist rows (FAFSA, and once a snapshot exists, Common App sections
 * and the personal essay) exist and are reconciled against the current application list. */
export async function ensureStudentWideItems(sdb: StudentDb, ctx: EnsureStudentWideItemsContext): Promise<void> {
  const applications = await sdb.select(S.applications);
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const reqRows = schoolIds.length ? await sdb.db.select().from(S.schoolRequirements).where(inArray(S.schoolRequirements.schoolId, schoolIds)) : [];
  const reqByschool = new Map<string, S.SchoolRequirementsRow>();
  for (const r of reqRows) {
    const cur = reqByschool.get(r.schoolId);
    if (!cur || r.updatedAt > cur.updatedAt) reqByschool.set(r.schoolId, r);
  }

  const checklistApplications: ChecklistApplication[] = [];
  let earliestCssDeadline: IsoDate | null = null;
  let needsCss = false;
  let earliestFafsaPriority: IsoDate | null = null;

  for (const a of applications) {
    const school = schoolById.get(a.schoolId);
    if (!school) continue;
    checklistApplications.push({
      id: a.id,
      plan: a.plan,
      deadline: a.deadline,
      schoolSlug: school.slug,
      schoolName: school.name,
      commonAppMember: school.commonAppMember,
      status: a.status,
    });
    const req = reqByschool.get(a.schoolId)?.data;
    if (!req) continue;
    if (req.css_profile.required) {
      needsCss = true;
      const due = cssProfileDueDate(req.css_profile, a.deadline);
      if (due && (!earliestCssDeadline || due < earliestCssDeadline)) earliestCssDeadline = due;
    }
    if (req.fafsa_priority_deadline && (!earliestFafsaPriority || req.fafsa_priority_deadline < earliestFafsaPriority)) {
      earliestFafsaPriority = req.fafsa_priority_deadline;
    }
  }

  const snapshotRows = await sdb.select(S.commonAppSnapshots, undefined, { orderBy: desc(S.commonAppSnapshots.createdAt), limit: 1 });
  const latestSnapshot = snapshotRows[0] ?? null;

  const input: StudentWideChecklistInput = {
    applications: checklistApplications,
    sections: latestSnapshot?.normalized.sections ?? null,
    testing: latestSnapshot?.normalized.testing ?? null,
    student: ctx.student,
    today: ctx.today,
    capturedAt: latestSnapshot?.normalized.captured_at ?? null,
    earliestCssDeadline,
    needsCss,
    earliestFafsaPriority,
  };
  const specs = buildStudentWideChecklist(input);
  const previousItems = await sdb.select(S.applicationItems, isNull(S.applicationItems.applicationId));
  const { toInsert, toUpdate, toDelete } = reconcile(previousItems, specs, null);
  if (toInsert.length > 0) await sdb.insert(S.applicationItems, toInsert.map((s) => toItemValues(null, s)));
  for (const u of toUpdate) await sdb.update(S.applicationItems, u.set, eq(S.applicationItems.id, u.id));
  if (toDelete.length > 0) await sdb.delete(S.applicationItems, inArray(S.applicationItems.id, toDelete));

  if (ctx.enqueuer) {
    await ctx.enqueuer.enqueue('maintenance.recompute_next_actions', { studentId: sdb.studentId, reason: 'student_wide_items' });
  }
}
