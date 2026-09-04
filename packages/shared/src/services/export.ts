/**
 * Builds a full JSON export of everything the system stores about one student, for the
 * account-export feature. Every student-owned table is included; credentials are reduced to
 * `{ provider, username, status }` (never the ciphertext).
 */
import { eq } from 'drizzle-orm';
import * as S from '../db/schema';
import { AuthorizationError } from '../db/repos/scoped';
import type { StudentDb } from '../db/repos/scoped';

export interface CredentialExport {
  provider: string;
  username: string;
  status: string;
}

export interface AccountExport {
  exported_at: string;
  student: S.Student;
  profile: S.StudentProfile | null;
  narratives: S.StudentNarrativeRow[];
  activities: S.Activity[];
  documents: S.Document[];
  applications: S.Application[];
  application_items: S.ApplicationItem[];
  common_app_snapshots: S.CommonAppSnapshotRow[];
  essays: S.Essay[];
  essay_drafts: S.EssayDraft[];
  essay_feedback: S.EssayFeedbackRow[];
  recommenders: S.Recommender[];
  recommender_assignments: S.RecommenderAssignment[];
  next_actions: S.NextAction[];
  conversations: S.Conversation[];
  messages: S.Message[];
  agent_runs: S.AgentRun[];
  approvals: S.Approval[];
  browser_jobs: S.BrowserJob[];
  audit_log: S.AuditEntry[];
  credentials: CredentialExport[];
  nudges: S.Nudge[];
  weekly_plans: S.WeeklyPlanRow[];
}

export async function buildAccountExport(sdb: StudentDb): Promise<AccountExport> {
  const studentRows = await sdb.db.select().from(S.students).where(eq(S.students.id, sdb.studentId)).limit(1);
  const student = studentRows[0];
  if (!student) throw new AuthorizationError();

  const [
    profile,
    narratives,
    activities,
    documents,
    applications,
    applicationItems,
    snapshots,
    essays,
    essayDrafts,
    essayFeedbackRows,
    recommenders,
    recommenderAssignments,
    nextActions,
    conversations,
    messages,
    agentRuns,
    approvals,
    browserJobs,
    auditLog,
    credentialRows,
    nudges,
    weeklyPlans,
  ] = await Promise.all([
    sdb.selectOne(S.studentProfiles),
    sdb.select(S.studentNarratives),
    sdb.select(S.activities),
    sdb.select(S.documents),
    sdb.select(S.applications),
    sdb.select(S.applicationItems),
    sdb.select(S.commonAppSnapshots),
    sdb.select(S.essays),
    sdb.select(S.essayDrafts),
    sdb.select(S.essayFeedback),
    sdb.select(S.recommenders),
    sdb.select(S.recommenderAssignments),
    sdb.select(S.nextActions),
    sdb.select(S.conversations),
    sdb.select(S.messages),
    sdb.select(S.agentRuns),
    sdb.select(S.approvals),
    sdb.select(S.browserJobs),
    sdb.select(S.auditLog),
    sdb.select(S.credentials),
    sdb.select(S.nudges),
    sdb.select(S.weeklyPlans),
  ]);

  return {
    exported_at: new Date().toISOString(),
    student,
    profile,
    narratives,
    activities,
    documents,
    applications,
    application_items: applicationItems,
    common_app_snapshots: snapshots,
    essays,
    essay_drafts: essayDrafts,
    essay_feedback: essayFeedbackRows,
    recommenders,
    recommender_assignments: recommenderAssignments,
    next_actions: nextActions,
    conversations,
    messages,
    agent_runs: agentRuns,
    approvals,
    browser_jobs: browserJobs,
    audit_log: auditLog,
    credentials: credentialRows.map((c) => ({ provider: c.provider, username: c.username, status: c.status })),
    nudges,
    weekly_plans: weeklyPlans,
  };
}
