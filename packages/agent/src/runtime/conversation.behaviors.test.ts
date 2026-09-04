import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { browserJobsRepo, nudgesRepo, scoped, type Db } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { getTestDb, truncateAll } from '@tbd/shared/testing';
import type { MemoryJobEnqueuer } from '@tbd/shared/jobs';
import { buildTestDeps, sendInboundText } from '../testing/deps';
import { InMemoryMessagingProvider } from '../testing/messaging';
import { seedDemoStudent } from '../testing/seed';
import type { AgentDeps } from './deps';
import { runConversationTurn } from './conversation';

describe('conversation behaviors', () => {
  let db: Db;

  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll(db);
  });

  it('"what\'s next" calls listNextActions and answers with item-backed text', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const { messageId } = await sendInboundText(db, seed.studentId, "what's next");

    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'listNextActions' && t.ok)).toBe(true);
    const text = result.texts.join(' ');
    expect(text).toContain('Michigan');
  });

  it('"how am I doing on Michigan" calls listNextActions + getApplicationStatus and answers with school/item/day facts', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const { messageId } = await sendInboundText(db, seed.studentId, 'how am I doing on Michigan');

    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'listNextActions' && t.ok)).toBe(true);
    expect(result.toolsCalled.some((t) => t.name === 'getApplicationStatus' && t.ok)).toBe(true);
    const text = result.texts.join(' ');
    expect(text).toContain('Michigan');
    expect(/\d+d\b/.test(text)).toBe(true);
  });

  it('"done with the Georgetown supp" marks the item done, acknowledges its nudge, sends a like tapback, and replies once, briefly', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const sdb = scoped(db, seed.studentId);
    await nudgesRepo.recordSent(sdb, { kind: 'essay_staleness', triggerKey: `essay_staleness:${seed.georgetownSuppItemId}`, applicationItemId: seed.georgetownSuppItemId });

    const { messageId } = await sendInboundText(db, seed.studentId, 'done with the Georgetown supp');
    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'markItemDone' && t.ok)).toBe(true);
    const itemRows = await db.select().from(S.applicationItems).where(eq(S.applicationItems.id, seed.georgetownSuppItemId)).limit(1);
    expect(itemRows[0]?.status).toBe('done');

    const nudgeRows = await sdb.select(S.nudges, eq(S.nudges.applicationItemId, seed.georgetownSuppItemId));
    expect(nudgeRows[0]?.acknowledgedAt).not.toBeNull();

    const messaging = deps.messaging as InMemoryMessagingProvider;
    expect(messaging.reactions.some((r) => r.reaction === 'like')).toBe(true);

    expect(result.texts.length).toBe(1);
    expect(result.texts[0]!.length).toBeLessThan(200);
  });

  it('a photo of a teacher\'s email updates the recommender assignment with evidence and confirms in one line', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const storageKey = `${seed.studentId}/photo/park-email.jpg`;
    await deps.storage.put(storageKey, Buffer.from('Ms. Park just submitted your recommendation letter for University of Michigan.', 'utf8'), 'image/jpeg');
    const { messageId } = await sendInboundText(db, seed.studentId, "here's the email from ms park", {
      media: [{ storage_key: storageKey, content_type: 'image/jpeg', document_id: null, url: null, filename: 'park-email.jpg' }],
    });

    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'updateRecommenderStatus' && t.ok)).toBe(true);
    const sdb = scoped(db, seed.studentId);
    const assignmentRows = await sdb.select(S.recommenderAssignments, eq(S.recommenderAssignments.id, seed.recommenderAssignmentId));
    expect(assignmentRows[0]?.status).toBe('submitted');
    expect(assignmentRows[0]?.evidence?.text).toBeTruthy();

    expect(result.texts.length).toBe(1);
    expect(result.texts[0]).toContain('Park');
  });

  it('proposing then approving a Common App fill: approval created pending, then approved with a queued fill job', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const sdb = scoped(db, seed.studentId);

    const propose = await sendInboundText(db, seed.studentId, 'can you put my activities into common app');
    const proposeResult = await runConversationTurn(deps, { studentId: seed.studentId, messageId: propose.messageId, conversationKind: 'main' });

    expect(proposeResult.toolsCalled.some((t) => t.name === 'proposeFillFields' && t.ok)).toBe(true);
    const pendingApprovals = await sdb.select(S.approvals, eq(S.approvals.status, 'pending'));
    expect(pendingApprovals.length).toBe(1);
    expect(pendingApprovals[0]?.payload.kind).toBe('fill_fields');
    expect(proposeResult.texts.join(' ')).toMatch(/\?/);

    const approve = await sendInboundText(db, seed.studentId, 'yes');
    const approveResult = await runConversationTurn(deps, { studentId: seed.studentId, messageId: approve.messageId, conversationKind: 'main' });

    expect(approveResult.toolsCalled.some((t) => t.name === 'approveProposal' && t.ok)).toBe(true);
    const approvals = await sdb.select(S.approvals, eq(S.approvals.id, pendingApprovals[0]!.id));
    expect(approvals[0]?.status).toBe('approved');

    const jobs = await sdb.select(S.browserJobs, eq(S.browserJobs.kind, 'fill_fields'));
    expect(jobs.length).toBe(1);

    const enqueuer = deps.enqueuer as MemoryJobEnqueuer;
    expect(enqueuer.ofName('browser.fill_fields').length).toBe(1);
    expect(enqueuer.ofName('browser.fill_fields')[0]?.payload.approvalId).toBe(approvals[0]?.id);
  });

  it('a verification code round-trip: the code reaches the waiting browser job and is never stored in the DB', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const sdb = scoped(db, seed.studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'verify_credentials', provider: 'local' });
    await browserJobsRepo.update(sdb, job.id, { status: 'awaiting_verification_code' });

    const waiter = deps.codeChannel.waitFor(job.id, 5000);
    const { messageId } = await sendInboundText(db, seed.studentId, '483920');
    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'answerVerificationCode' && t.ok)).toBe(true);
    const received = await waiter;
    expect(received).toBe('483920');

    const auditRows = await db.select().from(S.auditLog).where(eq(S.auditLog.studentId, seed.studentId));
    expect(JSON.stringify(auditRows.map((a) => a.details))).not.toContain('483920');
    const jobRows = await sdb.select(S.browserJobs, eq(S.browserJobs.id, job.id));
    expect(JSON.stringify(jobRows[0]?.result ?? {})).not.toContain('483920');
  });

  it('"leave me alone tonight" snoozes notifications', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const before = deps.clock.now();

    const { messageId } = await sendInboundText(db, seed.studentId, 'leave me alone tonight');
    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'snoozeNotifications' && t.ok)).toBe(true);
    const studentRows = await db.select().from(S.students).where(eq(S.students.id, seed.studentId)).limit(1);
    const student = studentRows[0];
    expect(student?.snoozedUntil).not.toBeNull();
    expect(student!.snoozedUntil!.getTime()).toBeGreaterThan(before.getTime());
  });

  it('"i\'m stressed" gives one small next step, briefly, with no lecture', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const { messageId } = await sendInboundText(db, seed.studentId, "i'm so stressed, I don't know what to do");

    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.map((t) => t.name)).toEqual(['listNextActions']);
    expect(result.texts.length).toBe(1);
    const sentenceCount = (result.texts[0]!.match(/[.!?]+(\s|$)/g) ?? []).length;
    expect(sentenceCount).toBeLessThanOrEqual(2);
  });

  it('"add Purdue" creates the application, seeds requirements, and builds a checklist', async () => {
    const seed = await seedDemoStudent(db);
    const deps = buildTestDeps(db);
    const { messageId } = await sendInboundText(db, seed.studentId, 'add Purdue');

    const result = await runConversationTurn(deps, { studentId: seed.studentId, messageId, conversationKind: 'main' });

    expect(result.toolsCalled.some((t) => t.name === 'addApplication' && t.ok)).toBe(true);
    const sdb = scoped(db, seed.studentId);
    const applications = await sdb.select(S.applications);
    expect(applications.length).toBe(3); // Michigan + Georgetown from the seed, plus Purdue

    const schools = await db.select().from(S.schools).where(eq(S.schools.slug, 'purdue'));
    expect(schools.length).toBe(1);
    const purdueApp = applications.find((a) => a.schoolId === schools[0]!.id);
    expect(purdueApp).toBeTruthy();

    const items = await sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, purdueApp!.id));
    expect(items.length).toBeGreaterThan(0);

    const requirements = await db.select().from(S.schoolRequirements).where(eq(S.schoolRequirements.schoolId, schools[0]!.id));
    expect(requirements.length).toBe(1);
  });
});
