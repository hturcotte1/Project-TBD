/**
 * Everything a system prompt needs about one student, loaded through `scoped()` so every query
 * is authorized to that student. See `src/persona.ts` for how this gets rendered into a prompt.
 */
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { approvalsRepo, AuthorizationError, browserJobsRepo, scoped, studentsRepo, type Db } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import type { Clock } from '@tbd/shared/time';
import { daysUntil } from '@tbd/shared/time';
import type { Env } from '@tbd/shared/config';

export interface ApplicationView {
  application: S.Application;
  school: S.School;
  daysRemaining: number | null;
}

export interface EssayView {
  essay: S.Essay;
  currentWordCount: number | null;
  applicationSchoolName: string | null;
}

export interface RecommenderView {
  recommender: S.Recommender;
  assignments: Array<{ assignment: S.RecommenderAssignment; schoolName: string | null }>;
}

export interface StudentContext {
  now: Date;
  student: S.Student;
  profile: S.StudentProfile | null;
  narrative: S.StudentNarrativeRow | null;
  applications: ApplicationView[];
  /** Open (not done/not_applicable) items, top 25 ordered by due date. */
  openItems: S.ApplicationItem[];
  openNextActions: S.NextAction[];
  pendingApprovals: S.Approval[];
  awaitingVerificationJob: S.BrowserJob | null;
  lastSyncedAt: Date | null;
  essays: EssayView[];
  recommenders: RecommenderView[];
}

const OPEN_ITEM_STATUSES: S.ApplicationItem['status'][] = ['missing', 'in_progress', 'blocked'];

export async function loadStudentContext(db: Db, studentId: string, clock: Clock, _env: Env): Promise<StudentContext> {
  const sdb = scoped(db, studentId);
  const now = clock.now();

  const student = await studentsRepo.findById(db, studentId);
  if (!student) throw new AuthorizationError();
  const profile = await sdb.selectOne(S.studentProfiles);
  const narrative = await sdb.selectOne(S.studentNarratives, undefined, { orderBy: desc(S.studentNarratives.version) });

  const applications = await sdb.select(S.applications);
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const applicationViews: ApplicationView[] = [];
  for (const application of applications) {
    const applicationSchool = schoolById.get(application.schoolId);
    if (!applicationSchool) continue;
    applicationViews.push({
      application,
      school: applicationSchool,
      daysRemaining: daysUntil(application.deadline, now, student.timezone),
    });
  }

  const openItems = await sdb.select(S.applicationItems, inArray(S.applicationItems.status, OPEN_ITEM_STATUSES), {
    orderBy: [asc(S.applicationItems.dueDate), asc(S.applicationItems.importance)],
    limit: 25,
  });

  const openNextActions = await sdb.select(S.nextActions, eq(S.nextActions.status, 'open'), { orderBy: asc(S.nextActions.rank), limit: 25 });

  const pendingApprovals = await approvalsRepo.pending(sdb);
  const awaitingVerificationJob = await browserJobsRepo.awaitingVerification(sdb);
  const lastSyncJob = await browserJobsRepo.latest(sdb, 'full_sync');
  const lastSyncedAt = lastSyncJob?.status === 'succeeded' ? (lastSyncJob.finishedAt ?? null) : null;

  const essayRows = await sdb.select(S.essays);
  const draftIds = essayRows.map((e) => e.currentDraftId).filter((id): id is string => Boolean(id));
  const drafts = draftIds.length ? await sdb.select(S.essayDrafts, inArray(S.essayDrafts.id, draftIds)) : [];
  const draftById = new Map(drafts.map((d) => [d.id, d]));
  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const essays: EssayView[] = essayRows.map((essay) => {
    const draft = essay.currentDraftId ? draftById.get(essay.currentDraftId) : undefined;
    const application = essay.applicationId ? applicationById.get(essay.applicationId) : undefined;
    const applicationSchool = application ? schoolById.get(application.schoolId) : undefined;
    return { essay, currentWordCount: draft?.wordCount ?? null, applicationSchoolName: applicationSchool?.name ?? null };
  });

  const recommenderRows = await sdb.select(S.recommenders);
  const recommenderIds = recommenderRows.map((r) => r.id);
  const assignmentRows = recommenderIds.length
    ? await sdb.select(S.recommenderAssignments, inArray(S.recommenderAssignments.recommenderId, recommenderIds))
    : [];
  const recommenders: RecommenderView[] = recommenderRows.map((recommender) => ({
    recommender,
    assignments: assignmentRows
      .filter((a) => a.recommenderId === recommender.id)
      .map((assignment) => {
        const application = applicationById.get(assignment.applicationId);
        const applicationSchool = application ? schoolById.get(application.schoolId) : undefined;
        return { assignment, schoolName: applicationSchool?.name ?? null };
      }),
  }));

  return {
    now,
    student,
    profile,
    narrative,
    applications: applicationViews,
    openItems,
    openNextActions,
    pendingApprovals,
    awaitingVerificationJob,
    lastSyncedAt,
    essays,
    recommenders,
  };
}
