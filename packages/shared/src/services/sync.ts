/**
 * Applies a freshly captured Common App snapshot to a student's stored state: saves the
 * `common_app_snapshots` row, matches every snapshot college to an `applications` row, rebuilds
 * each application's checklist (and the student-wide checklist) through `buildChecklist` /
 * `buildStudentWideChecklist` + `reconcile`, updates application status/deadline, upserts
 * recommenders and their per-application assignments, links recommender items, verifies
 * supplement titles against the school's requirements, and recomputes `next_actions`.
 *
 * `applyRecommenderUpdates` is the lighter path `browser.check_recommenders` uses: the same
 * recommender upsert/link logic, scoped to only `teacher_rec`/`counselor_rec` items, with no new
 * snapshot row and no touch to application status/deadline/supplement verification.
 */
import { and, eq, inArray } from 'drizzle-orm';
import * as S from '../db/schema';
import type { StudentDb } from '../db/repos/scoped';
import type { DbOrTx } from '../db/client';
import { studentsRepo } from '../db/repos/core';
import type { ItemKind } from '../domain/enums';
import {
  buildChecklist,
  buildStudentWideChecklist,
  cssProfileDueDate,
  reconcile,
  supplementsForPlan,
} from '../requirements';
import type { ChecklistApplication, ChecklistInput, ChecklistItemSpec, ChecklistStudent, StudentWideChecklistInput } from '../requirements';
import type { IsoDate } from '../schemas/common';
import type { ItemEvidence } from '../schemas/items';
import type { CollegeSnapshot, CommonAppSnapshot, RecommenderEntry, StateChange } from '../schemas/snapshot';
import { recomputeNextActions } from './nextActions';

// ---------- shared helpers ----------

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
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

async function loadChecklistStudent(sdb: StudentDb): Promise<ChecklistStudent> {
  const profile = await sdb.selectOne(S.studentProfiles);
  return {
    testStance: profile?.testScores.test_optional_stance ?? 'undecided',
    hasSatOrAct: Boolean(profile && (profile.testScores.sat.length > 0 || profile.testScores.act.length > 0)),
    financialConstraints: profile?.demographics.financial_constraints ?? null,
    firstGeneration: profile?.demographics.first_generation ?? null,
  };
}

interface ApplicationContext {
  application: S.Application;
  school: S.School;
  requirementsRow: S.SchoolRequirementsRow;
}

/** Every application, its school row, and the latest requirements row for that school (by cycle). */
async function loadApplicationContexts(db: DbOrTx, sdb: StudentDb): Promise<ApplicationContext[]> {
  const applications = await sdb.select(S.applications);
  if (applications.length === 0) return [];
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = await db.select().from(S.schools).where(inArray(S.schools.id, schoolIds));
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const reqRows = await db.select().from(S.schoolRequirements).where(inArray(S.schoolRequirements.schoolId, schoolIds));
  const reqBySchool = new Map<string, S.SchoolRequirementsRow>();
  for (const r of reqRows) {
    const cur = reqBySchool.get(r.schoolId);
    if (!cur || r.updatedAt > cur.updatedAt) reqBySchool.set(r.schoolId, r);
  }
  const out: ApplicationContext[] = [];
  for (const application of applications) {
    const school = schoolById.get(application.schoolId);
    const requirementsRow = school ? reqBySchool.get(school.id) : undefined;
    if (!school || !requirementsRow) continue;
    out.push({ application, school, requirementsRow });
  }
  return out;
}

/** Matches a snapshot college to an application: by `common_app_college_id`, then by school slug
 * (the seed/mock use the slug as the college id), then case-insensitively by school name/alias. */
function matchCollege(snapshot: CommonAppSnapshot, application: S.Application, school: S.School): CollegeSnapshot | null {
  if (application.commonAppCollegeId) {
    const byId = snapshot.colleges.find((c) => c.common_app_college_id === application.commonAppCollegeId);
    if (byId) return byId;
  }
  const bySlug = snapshot.colleges.find((c) => c.common_app_college_id === school.slug);
  if (bySlug) return bySlug;
  const names = new Set([school.name.toLowerCase(), ...school.aliases.map((a) => a.toLowerCase())]);
  return snapshot.colleges.find((c) => names.has(c.name.toLowerCase())) ?? null;
}

interface ReconcileOutcome {
  inserted: S.ApplicationItem[];
  updated: S.ApplicationItem[];
  deleted: number;
}

/** Inserts/updates/deletes `application_items` for one scope. When `onlyKinds` is given, both the
 * previously-stored rows and the freshly built specs are filtered to those kinds first, so the
 * comparison window (and thus what gets deleted) never reaches outside them. */
async function reconcileApplicationItems(
  sdb: StudentDb,
  applicationId: string | null,
  specs: ChecklistItemSpec[],
  opts: { onlyKinds?: ItemKind[] } = {},
): Promise<ReconcileOutcome> {
  const scopeCond = applicationId === null ? undefined : eq(S.applicationItems.applicationId, applicationId);
  const allPrevious =
    applicationId === null
      ? (await sdb.select(S.applicationItems)).filter((r) => r.applicationId === null)
      : await sdb.select(S.applicationItems, scopeCond);
  const previous = opts.onlyKinds ? allPrevious.filter((r) => (opts.onlyKinds as ItemKind[]).includes(r.kind)) : allPrevious;
  const filteredSpecs = opts.onlyKinds ? specs.filter((s) => (opts.onlyKinds as ItemKind[]).includes(s.kind)) : specs;

  const { toInsert, toUpdate, toDelete } = reconcile(previous, filteredSpecs, applicationId);

  const inserted = toInsert.length > 0 ? await sdb.insert(S.applicationItems, toInsert.map((s) => toItemValues(applicationId, s))) : [];
  const updated: S.ApplicationItem[] = [];
  for (const u of toUpdate) {
    const [row] = await sdb.update(S.applicationItems, u.set, eq(S.applicationItems.id, u.id));
    if (row) updated.push(row);
  }
  if (toDelete.length > 0) await sdb.delete(S.applicationItems, inArray(S.applicationItems.id, toDelete));

  return { inserted, updated, deleted: toDelete.length };
}

// ---------- recommenders ----------

const INVITE_STATUS_RANK: Record<S.Recommender['inviteStatus'], number> = { not_invited: 0, invited: 1, submitted: 2 };
/** Same ranking `buildChecklist`'s (unexported) teacher-slot sort uses, so `teacher_rec:<n>` lines
 * up with the same teacher here as it did when the item specs were built. */
const TEACHER_ENTRY_RANK: Record<RecommenderEntry['status'], number> = { submitted: 0, invited: 1, not_invited: 2, declined: 3, unknown: 4 };

function mapInviteStatus(status: RecommenderEntry['status']): S.Recommender['inviteStatus'] {
  if (status === 'submitted') return 'submitted';
  if (status === 'invited') return 'invited';
  return 'not_invited';
}

function mapAssignmentStatus(status: RecommenderEntry['status']): S.RecommenderAssignment['status'] {
  if (status === 'submitted') return 'submitted';
  if (status === 'invited') return 'invited';
  return 'pending';
}

function recommenderEvidenceText(entry: RecommenderEntry): string {
  switch (entry.status) {
    case 'submitted':
      return `${entry.name} — submitted${entry.submitted_at ? ` ${entry.submitted_at}` : ''}`;
    case 'invited':
      return `${entry.name} — invited${entry.invited_at ? ` ${entry.invited_at}` : ''}, not submitted`;
    case 'declined':
      return `${entry.name} — declined`;
    case 'not_invited':
      return `${entry.name} — not yet invited`;
    case 'unknown':
      return `${entry.name} — status unknown`;
  }
}

function recommenderConfidence(status: RecommenderEntry['status']): number {
  if (status === 'unknown') return 0.3;
  if (status === 'invited') return 0.8;
  return 0.9;
}

async function loadRecommenderCache(sdb: StudentDb): Promise<Map<string, S.Recommender>> {
  const rows = await sdb.select(S.recommenders);
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r]));
}

/** Finds-or-creates the recommender row by case-insensitive name match, bumping its top-level
 * `inviteStatus`/`invitedAt` forward (never backward) when this entry reports more progress. */
async function upsertRecommender(sdb: StudentDb, cache: Map<string, S.Recommender>, entry: RecommenderEntry): Promise<S.Recommender> {
  const key = entry.name.trim().toLowerCase();
  const existing = cache.get(key);
  const desired = mapInviteStatus(entry.status);
  if (existing) {
    if (INVITE_STATUS_RANK[desired] > INVITE_STATUS_RANK[existing.inviteStatus]) {
      const [row] = await sdb.update(
        S.recommenders,
        { inviteStatus: desired, invitedAt: entry.invited_at ?? existing.invitedAt, subject: existing.subject ?? entry.subject },
        eq(S.recommenders.id, existing.id),
      );
      if (row) {
        cache.set(key, row);
        return row;
      }
    }
    return existing;
  }
  const [row] = await sdb.insert(S.recommenders, { name: entry.name, role: entry.role, email: null, subject: entry.subject, inviteStatus: desired, invitedAt: entry.invited_at });
  if (!row) throw new Error('failed to create recommender');
  cache.set(key, row);
  return row;
}

async function upsertAssignment(sdb: StudentDb, recommenderId: string, applicationId: string, entry: RecommenderEntry, capturedAt: string): Promise<void> {
  const status = mapAssignmentStatus(entry.status);
  const evidence: ItemEvidence = { seen_at: capturedAt, text: recommenderEvidenceText(entry).slice(0, 500), confidence: recommenderConfidence(entry.status), source_url: null };
  await sdb.db
    .insert(S.recommenderAssignments)
    .values({ studentId: sdb.studentId, recommenderId, applicationId, status, invitedAt: entry.invited_at, submittedAt: entry.submitted_at, evidence })
    .onConflictDoUpdate({
      target: [S.recommenderAssignments.recommenderId, S.recommenderAssignments.applicationId],
      set: { status, invitedAt: entry.invited_at, submittedAt: entry.submitted_at, evidence, updatedAt: new Date() },
    });
}

function sortedTeachers(college: CollegeSnapshot): RecommenderEntry[] {
  return [...college.teachers].sort((a, b) => TEACHER_ENTRY_RANK[a.status] - TEACHER_ENTRY_RANK[b.status]);
}

/** Upserts every recommender/assignment seen on one college's Recommenders page; returns the
 * ruleKey -> recommenderId map (`teacher_rec:<n>`, `counselor_rec`) for linking application items. */
async function applyRecommendersForCollege(
  sdb: StudentDb,
  applicationId: string,
  college: CollegeSnapshot,
  capturedAt: string,
  cache: Map<string, S.Recommender>,
): Promise<Map<string, string>> {
  const linking = new Map<string, string>();
  const teachers = sortedTeachers(college);
  for (let i = 0; i < teachers.length; i++) {
    const entry = teachers[i];
    if (!entry) continue;
    const rec = await upsertRecommender(sdb, cache, entry);
    await upsertAssignment(sdb, rec.id, applicationId, entry, capturedAt);
    linking.set(`teacher_rec:${i + 1}`, rec.id);
  }
  if (college.counselor) {
    const rec = await upsertRecommender(sdb, cache, college.counselor);
    await upsertAssignment(sdb, rec.id, applicationId, college.counselor, capturedAt);
    linking.set('counselor_rec', rec.id);
  }
  for (const entry of college.others) {
    const rec = await upsertRecommender(sdb, cache, entry);
    await upsertAssignment(sdb, rec.id, applicationId, entry, capturedAt);
  }
  return linking;
}

async function linkRecommenderItems(sdb: StudentDb, applicationId: string, linking: Map<string, string>): Promise<void> {
  if (linking.size === 0) return;
  const items = await sdb.select(
    S.applicationItems,
    and(eq(S.applicationItems.applicationId, applicationId), inArray(S.applicationItems.kind, ['teacher_rec', 'counselor_rec'])),
  );
  for (const item of items) {
    const recId = linking.get(item.ruleKey);
    if (recId && item.recommenderId !== recId) {
      await sdb.update(S.applicationItems, { recommenderId: recId }, eq(S.applicationItems.id, item.id));
    }
  }
}

function toChecklistApplication(application: S.Application, school: S.School): ChecklistApplication {
  return {
    id: application.id,
    plan: application.plan,
    deadline: application.deadline,
    schoolSlug: school.slug,
    schoolName: school.name,
    commonAppMember: school.commonAppMember,
    status: application.status,
  };
}

// ---------- applySnapshot ----------

export interface ApplySnapshotInput {
  snapshot: CommonAppSnapshot;
  raw: Record<string, unknown>;
  diff: StateChange[];
  browserJobId: string;
  today: IsoDate;
  capturedAt: string;
  overallConfidence: number;
}

export interface ApplySnapshotResult {
  snapshotId: string;
  changes: StateChange[];
  itemsInserted: number;
  itemsUpdated: number;
  itemsDeleted: number;
}

/**
 * Persists a captured snapshot and reconciles every application (plus the student-wide items)
 * against it. Runs as one logical unit — callers that want it atomic should pass a transaction
 * as both `db` and (via `scoped(tx, studentId)`) `sdb`.
 */
export async function applySnapshot(db: DbOrTx, sdb: StudentDb, input: ApplySnapshotInput): Promise<ApplySnapshotResult> {
  const [snapshotRow] = await sdb.insert(S.commonAppSnapshots, {
    browserJobId: input.browserJobId,
    raw: input.raw,
    normalized: input.snapshot,
    diff: input.diff,
    overallConfidence: input.overallConfidence.toFixed(3),
  });
  if (!snapshotRow) throw new Error('failed to insert common_app_snapshot');

  const student = await loadChecklistStudent(sdb);
  const contexts = await loadApplicationContexts(db, sdb);
  const recommenderCache = await loadRecommenderCache(sdb);

  let itemsInserted = 0;
  let itemsUpdated = 0;
  let itemsDeleted = 0;
  const checklistApplications: ChecklistApplication[] = [];
  let earliestCssDeadline: IsoDate | null = null;
  let needsCss = false;
  let earliestFafsaPriority: IsoDate | null = null;

  for (const { application, school, requirementsRow } of contexts) {
    const requirements = requirementsRow.data;
    const checklistApplication = toChecklistApplication(application, school);
    checklistApplications.push(checklistApplication);

    if (requirements.css_profile.required) {
      needsCss = true;
      const due = cssProfileDueDate(requirements.css_profile, application.deadline);
      if (due && (!earliestCssDeadline || due < earliestCssDeadline)) earliestCssDeadline = due;
    }
    if (requirements.fafsa_priority_deadline && (!earliestFafsaPriority || requirements.fafsa_priority_deadline < earliestFafsaPriority)) {
      earliestFafsaPriority = requirements.fafsa_priority_deadline;
    }

    const college = matchCollege(input.snapshot, application, school);
    const checklistInput: ChecklistInput = {
      application: checklistApplication,
      requirements,
      snapshotCollege: college,
      sections: input.snapshot.sections,
      student,
      today: input.today,
      capturedAt: input.capturedAt,
    };
    const specs = buildChecklist(checklistInput);
    const { inserted, updated, deleted } = await reconcileApplicationItems(sdb, application.id, specs);
    itemsInserted += inserted.length;
    itemsUpdated += updated.length;
    itemsDeleted += deleted;

    if (college) {
      const linking = await applyRecommendersForCollege(sdb, application.id, college, input.capturedAt, recommenderCache);
      await linkRecommenderItems(sdb, application.id, linking);
    }

    const set: Partial<S.NewApplication> = { lastSyncedAt: new Date() };
    if (college) {
      if (college.submission_status === 'submitted') {
        set.status = 'submitted';
      } else if (college.review_submit_status === 'ready') {
        set.status = 'ready_to_submit';
      } else if (specs.some((s) => s.source === 'common_app' && (s.status === 'in_progress' || s.status === 'done'))) {
        set.status = 'in_progress';
      }
      if (college.plan === application.plan && college.deadline && college.deadline !== application.deadline) {
        set.deadline = college.deadline;
        set.deadlineSource = 'common_app';
      }
    }
    await sdb.update(S.applications, set, eq(S.applications.id, application.id));

    if (college) {
      const prompts = supplementsForPlan(requirements, application.plan);
      if (prompts.length > 0) {
        const seenTitles = new Set(college.supplements.map((s) => normalizeTitle(s.title)));
        const allSeen = prompts.every((p) => seenTitles.has(normalizeTitle(p.title)));
        if (allSeen && (requirementsRow.needsVerification || !requirementsRow.verifiedAt)) {
          await db
            .update(S.schoolRequirements)
            .set({ verifiedAt: new Date(), needsVerification: false })
            .where(eq(S.schoolRequirements.id, requirementsRow.id));
        }
      }
    }
  }

  const studentWideInput: StudentWideChecklistInput = {
    applications: checklistApplications,
    sections: input.snapshot.sections,
    testing: input.snapshot.testing,
    student,
    today: input.today,
    capturedAt: input.capturedAt,
    earliestCssDeadline,
    needsCss,
    earliestFafsaPriority,
  };
  const studentWideSpecs = buildStudentWideChecklist(studentWideInput);
  const { inserted: swIns, updated: swUpd, deleted: swDel } = await reconcileApplicationItems(sdb, null, studentWideSpecs);
  itemsInserted += swIns.length;
  itemsUpdated += swUpd.length;
  itemsDeleted += swDel;

  const studentRow = await studentsRepo.findById(db, sdb.studentId);
  await recomputeNextActions(sdb, { today: input.today, intensity: studentRow?.nudgeIntensity ?? 'normal', computedByRunId: input.browserJobId });

  return { snapshotId: snapshotRow.id, changes: input.diff, itemsInserted, itemsUpdated, itemsDeleted };
}

// ---------- applyRecommenderUpdates (browser.check_recommenders) ----------

export interface ApplyRecommenderUpdatesInput {
  snapshot: CommonAppSnapshot;
  today: IsoDate;
}

export interface ApplyRecommenderUpdatesResult {
  applicationsChecked: number;
  itemsChanged: number;
}

const RECOMMENDER_ITEM_KINDS: ItemKind[] = ['teacher_rec', 'counselor_rec'];

/** The lighter path for `browser.check_recommenders`: upserts recommenders/assignments and
 * refreshes only the `teacher_rec`/`counselor_rec` items — no new snapshot row, no application
 * status/deadline change, no supplement verification. */
export async function applyRecommenderUpdates(db: DbOrTx, sdb: StudentDb, input: ApplyRecommenderUpdatesInput): Promise<ApplyRecommenderUpdatesResult> {
  const student = await loadChecklistStudent(sdb);
  const contexts = await loadApplicationContexts(db, sdb);
  const cache = await loadRecommenderCache(sdb);

  let applicationsChecked = 0;
  let itemsChanged = 0;

  for (const { application, school, requirementsRow } of contexts) {
    const college = matchCollege(input.snapshot, application, school);
    if (!college) continue;
    applicationsChecked++;

    const checklistApplication = toChecklistApplication(application, school);
    const checklistInput: ChecklistInput = {
      application: checklistApplication,
      requirements: requirementsRow.data,
      snapshotCollege: college,
      sections: input.snapshot.sections,
      student,
      today: input.today,
      capturedAt: input.snapshot.captured_at,
    };
    const specs = buildChecklist(checklistInput);
    const { inserted, updated } = await reconcileApplicationItems(sdb, application.id, specs, { onlyKinds: RECOMMENDER_ITEM_KINDS });
    itemsChanged += inserted.length + updated.length;

    const linking = await applyRecommendersForCollege(sdb, application.id, college, input.snapshot.captured_at, cache);
    await linkRecommenderItems(sdb, application.id, linking);
  }

  if (applicationsChecked > 0) {
    const studentRow = await studentsRepo.findById(db, sdb.studentId);
    await recomputeNextActions(sdb, { today: input.today, intensity: studentRow?.nudgeIntensity ?? 'normal' });
  }

  return { applicationsChecked, itemsChanged };
}
