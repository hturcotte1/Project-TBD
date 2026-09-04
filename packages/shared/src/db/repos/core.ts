import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../client';
import * as S from '../schema';
import type { StudentDb } from './scoped';
import type { AuditActor, Channel, ConversationKind, CredentialProvider, NudgeKind } from '../../domain/enums';
import { decryptSecret, encryptSecret, type EncryptedBlob, type KeyRing } from '../../crypto/credentials';
import type { MediaRef } from '../../schemas/message';

// ---------- students (identity is the one place that legitimately queries across students) ----------
export const studentsRepo = {
  async findById(db: DbOrTx, id: string): Promise<S.Student | null> {
    const rows = await db.select().from(S.students).where(eq(S.students.id, id)).limit(1);
    return rows[0] ?? null;
  },
  async findByAuthUserId(db: DbOrTx, authUserId: string): Promise<S.Student | null> {
    const rows = await db.select().from(S.students).where(eq(S.students.authUserId, authUserId)).limit(1);
    return rows[0] ?? null;
  },
  async findByPhone(db: DbOrTx, phoneE164: string): Promise<S.Student | null> {
    const rows = await db.select().from(S.students).where(eq(S.students.phoneE164, phoneE164)).limit(1);
    return rows[0] ?? null;
  },
  async findByEmail(db: DbOrTx, email: string): Promise<S.Student | null> {
    const rows = await db.select().from(S.students).where(eq(S.students.email, email.toLowerCase())).limit(1);
    return rows[0] ?? null;
  },
  /** Called on first authenticated request: create the student row if it does not exist. */
  async upsertFromAuth(db: DbOrTx, input: { authUserId: string; email: string; isAdmin: boolean }): Promise<S.Student> {
    const existing = await studentsRepo.findByAuthUserId(db, input.authUserId);
    if (existing) {
      if (input.isAdmin && existing.role !== 'admin') {
        const [updated] = await db.update(S.students).set({ role: 'admin' }).where(eq(S.students.id, existing.id)).returning();
        return updated ?? existing;
      }
      return existing;
    }
    const [created] = await db
      .insert(S.students)
      .values({ authUserId: input.authUserId, email: input.email.toLowerCase(), role: input.isAdmin ? 'admin' : 'student' })
      .returning();
    if (!created) throw new Error('failed to create student');
    return created;
  },
  async listActive(db: DbOrTx): Promise<S.Student[]> {
    return db.select().from(S.students).where(eq(S.students.status, 'active'));
  },
};

// ---------- audit ----------
export interface AuditInput {
  actor: AuditActor;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  requestId?: string | null;
}
export async function appendAudit(sdb: StudentDb, input: AuditInput): Promise<S.AuditEntry> {
  const [row] = await sdb.insert(S.auditLog, {
    actor: input.actor,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    details: input.details ?? {},
    requestId: input.requestId ?? null,
  });
  if (!row) throw new Error('audit insert failed');
  return row;
}

// ---------- conversations & messages ----------
export const conversationsRepo = {
  async getOrCreate(sdb: StudentDb, kind: ConversationKind): Promise<S.Conversation> {
    const existing = await sdb.selectOne(S.conversations, eq(S.conversations.kind, kind));
    if (existing) return existing;
    const [created] = await sdb.db
      .insert(S.conversations)
      .values({ studentId: sdb.studentId, kind })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const again = await sdb.selectOne(S.conversations, eq(S.conversations.kind, kind));
    if (!again) throw new Error('conversation create failed');
    return again;
  },
};

export interface AppendMessageInput {
  conversationId: string;
  channel: Channel;
  direction: 'inbound' | 'outbound';
  kind?: 'text' | 'media' | 'reaction' | 'system_note';
  body: string;
  media?: MediaRef[];
  reaction?: string | null;
  inReplyToId?: string | null;
  providerMessageId?: string | null;
  deliveryStatus?: S.Message['deliveryStatus'];
  agentRunId?: string | null;
  proactive?: boolean;
}
export const messagesRepo = {
  async append(sdb: StudentDb, input: AppendMessageInput): Promise<S.Message> {
    const [row] = await sdb.insert(S.messages, {
      conversationId: input.conversationId,
      channel: input.channel,
      direction: input.direction,
      kind: input.kind ?? 'text',
      body: input.body,
      media: input.media ?? [],
      reaction: input.reaction ?? null,
      inReplyToId: input.inReplyToId ?? null,
      providerMessageId: input.providerMessageId ?? null,
      deliveryStatus: input.deliveryStatus ?? (input.direction === 'inbound' ? 'delivered' : 'queued'),
      agentRunId: input.agentRunId ?? null,
      proactive: input.proactive ?? false,
    });
    if (!row) throw new Error('message insert failed');
    return row;
  },
  /** Most recent N messages in chronological order. */
  async recent(sdb: StudentDb, conversationId: string, limit = 30): Promise<S.Message[]> {
    const rows = await sdb.select(S.messages, eq(S.messages.conversationId, conversationId), { orderBy: desc(S.messages.createdAt), limit });
    return rows.reverse();
  },
  async after(sdb: StudentDb, conversationId: string, after: Date | null, limit = 50): Promise<S.Message[]> {
    const cond = after
      ? and(eq(S.messages.conversationId, conversationId), gt(S.messages.createdAt, after))
      : eq(S.messages.conversationId, conversationId);
    const rows = await sdb.select(S.messages, cond, { orderBy: desc(S.messages.createdAt), limit });
    return rows.reverse();
  },
  async byProviderId(db: DbOrTx, providerMessageId: string): Promise<S.Message | null> {
    const rows = await db.select().from(S.messages).where(eq(S.messages.providerMessageId, providerMessageId)).limit(1);
    return rows[0] ?? null;
  },
};

// ---------- credentials (explicit columns; ciphertext only via decryptForWorker) ----------
export interface CredentialStatusView {
  provider: CredentialProvider;
  status: S.Credential['status'];
  username: string;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  failureCount: number;
}
export const credentialsRepo = {
  async store(sdb: StudentDb, ring: KeyRing, provider: CredentialProvider, username: string, secret: string): Promise<void> {
    const blob = encryptSecret(ring, secret, `${sdb.studentId}:${provider}`);
    await sdb.db
      .insert(S.credentials)
      .values({
        studentId: sdb.studentId,
        provider,
        username,
        ciphertext: blob.ciphertext,
        iv: blob.iv,
        authTag: blob.authTag,
        keyVersion: blob.keyVersion,
        status: 'active',
        failureCount: 0,
        sessionCiphertext: null,
        sessionIv: null,
        sessionAuthTag: null,
        sessionKeyVersion: null,
        sessionUpdatedAt: null,
        verifiedAt: null,
      })
      .onConflictDoUpdate({
        target: [S.credentials.studentId, S.credentials.provider],
        set: {
          username,
          ciphertext: blob.ciphertext,
          iv: blob.iv,
          authTag: blob.authTag,
          keyVersion: blob.keyVersion,
          status: 'active',
          failureCount: 0,
          sessionCiphertext: null,
          sessionIv: null,
          sessionAuthTag: null,
          sessionKeyVersion: null,
          sessionUpdatedAt: null,
          verifiedAt: null,
          updatedAt: new Date(),
        },
      });
  },
  async status(sdb: StudentDb, provider: CredentialProvider): Promise<CredentialStatusView | null> {
    const rows = await sdb.db
      .select({
        provider: S.credentials.provider,
        status: S.credentials.status,
        username: S.credentials.username,
        verifiedAt: S.credentials.verifiedAt,
        lastUsedAt: S.credentials.lastUsedAt,
        failureCount: S.credentials.failureCount,
      })
      .from(S.credentials)
      .where(and(eq(S.credentials.studentId, sdb.studentId), eq(S.credentials.provider, provider)))
      .limit(1);
    return rows[0] ?? null;
  },
  /** Worker-only. Returns the plaintext secret and any stored session state. */
  async decryptForWorker(
    sdb: StudentDb,
    ring: KeyRing,
    provider: CredentialProvider,
  ): Promise<{ username: string; secret: string; session: string | null } | null> {
    const rows = await sdb.db
      .select({
        username: S.credentials.username,
        status: S.credentials.status,
        ciphertext: S.credentials.ciphertext,
        iv: S.credentials.iv,
        authTag: S.credentials.authTag,
        keyVersion: S.credentials.keyVersion,
        sessionCiphertext: S.credentials.sessionCiphertext,
        sessionIv: S.credentials.sessionIv,
        sessionAuthTag: S.credentials.sessionAuthTag,
        sessionKeyVersion: S.credentials.sessionKeyVersion,
      })
      .from(S.credentials)
      .where(and(eq(S.credentials.studentId, sdb.studentId), eq(S.credentials.provider, provider)))
      .limit(1);
    const row = rows[0];
    if (!row || row.status === 'deleted') return null;
    const aad = `${sdb.studentId}:${provider}`;
    const secret = decryptSecret(ring, { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion }, aad);
    let session: string | null = null;
    if (row.sessionCiphertext && row.sessionIv && row.sessionAuthTag && row.sessionKeyVersion) {
      const blob: EncryptedBlob = { ciphertext: row.sessionCiphertext, iv: row.sessionIv, authTag: row.sessionAuthTag, keyVersion: row.sessionKeyVersion };
      session = decryptSecret(ring, blob, `${aad}:session`);
    }
    await sdb.update(S.credentials, { lastUsedAt: new Date() }, eq(S.credentials.provider, provider));
    return { username: row.username, secret, session };
  },
  async storeSession(sdb: StudentDb, ring: KeyRing, provider: CredentialProvider, sessionJson: string | null): Promise<void> {
    if (sessionJson === null) {
      await sdb.update(
        S.credentials,
        { sessionCiphertext: null, sessionIv: null, sessionAuthTag: null, sessionKeyVersion: null, sessionUpdatedAt: new Date() },
        eq(S.credentials.provider, provider),
      );
      return;
    }
    const blob = encryptSecret(ring, sessionJson, `${sdb.studentId}:${provider}:session`);
    await sdb.update(
      S.credentials,
      { sessionCiphertext: blob.ciphertext, sessionIv: blob.iv, sessionAuthTag: blob.authTag, sessionKeyVersion: blob.keyVersion, sessionUpdatedAt: new Date() },
      eq(S.credentials.provider, provider),
    );
  },
  async markVerified(sdb: StudentDb, provider: CredentialProvider): Promise<void> {
    await sdb.update(S.credentials, { status: 'active', verifiedAt: new Date(), failureCount: 0 }, eq(S.credentials.provider, provider));
  },
  async recordFailure(sdb: StudentDb, provider: CredentialProvider, invalid: boolean): Promise<number> {
    const [row] = await sdb.update(
      S.credentials,
      { failureCount: sql`${S.credentials.failureCount} + 1`, ...(invalid ? { status: 'invalid' as const } : {}) },
      eq(S.credentials.provider, provider),
    );
    return row?.failureCount ?? 0;
  },
  /** Disconnect: the row is deleted outright, never soft-deleted. */
  async remove(sdb: StudentDb, provider: CredentialProvider): Promise<boolean> {
    const rows = await sdb.delete(S.credentials, eq(S.credentials.provider, provider));
    return rows.length > 0;
  },
};

// ---------- nudges ----------
export const nudgesRepo = {
  async wasSent(sdb: StudentDb, triggerKey: string): Promise<boolean> {
    return (await sdb.count(S.nudges, eq(S.nudges.triggerKey, triggerKey))) > 0;
  },
  async recordSent(
    sdb: StudentDb,
    input: { kind: NudgeKind; triggerKey: string; applicationItemId?: string | null; applicationId?: string | null; messageId?: string | null; sentAt?: Date },
  ): Promise<S.Nudge> {
    const [row] = await sdb.db
      .insert(S.nudges)
      .values({
        studentId: sdb.studentId,
        kind: input.kind,
        triggerKey: input.triggerKey,
        applicationItemId: input.applicationItemId ?? null,
        applicationId: input.applicationId ?? null,
        messageId: input.messageId ?? null,
        sentAt: input.sentAt ?? new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const existing = await sdb.selectOne(S.nudges, eq(S.nudges.triggerKey, input.triggerKey));
    if (!existing) throw new Error('nudge insert failed');
    return existing;
  },
  /** Proactive sends since a given instant (for daily caps). */
  async sentSince(sdb: StudentDb, since: Date): Promise<S.Nudge[]> {
    return sdb.select(S.nudges, gt(S.nudges.sentAt, since));
  },
  async acknowledgeForItem(sdb: StudentDb, applicationItemId: string): Promise<void> {
    await sdb.update(S.nudges, { acknowledgedAt: new Date() }, and(eq(S.nudges.applicationItemId, applicationItemId), isNull(S.nudges.acknowledgedAt)));
  },
  async snoozeForItem(sdb: StudentDb, applicationItemId: string, until: Date): Promise<void> {
    await sdb.update(S.nudges, { snoozedUntil: until }, eq(S.nudges.applicationItemId, applicationItemId));
  },
  /** Items that must not be nudged again right now: acknowledged, or snoozed into the future. */
  async suppressedItemIds(sdb: StudentDb, now: Date): Promise<Set<string>> {
    const rows = await sdb.select(S.nudges, or(sql`${S.nudges.acknowledgedAt} is not null`, gt(S.nudges.snoozedUntil, now)));
    return new Set(rows.map((r) => r.applicationItemId).filter((x): x is string => Boolean(x)));
  },
};

// ---------- browser jobs ----------
export const browserJobsRepo = {
  async create(sdb: StudentDb, input: { kind: S.BrowserJob['kind']; provider: S.BrowserJob['provider']; approvalId?: string | null }): Promise<S.BrowserJob> {
    const [row] = await sdb.insert(S.browserJobs, { kind: input.kind, provider: input.provider, approvalId: input.approvalId ?? null, status: 'queued' });
    if (!row) throw new Error('browser job insert failed');
    return row;
  },
  async update(sdb: StudentDb, id: string, set: Partial<S.NewBrowserJob>): Promise<S.BrowserJob> {
    const [row] = await sdb.update(S.browserJobs, { ...set, updatedAt: new Date() }, eq(S.browserJobs.id, id));
    if (!row) throw new Error('browser job not found');
    return row;
  },
  async latest(sdb: StudentDb, kind?: S.BrowserJob['kind']): Promise<S.BrowserJob | null> {
    return sdb.selectOne(S.browserJobs, kind ? eq(S.browserJobs.kind, kind) : undefined, { orderBy: desc(S.browserJobs.createdAt) });
  },
  async awaitingVerification(sdb: StudentDb): Promise<S.BrowserJob | null> {
    return sdb.selectOne(S.browserJobs, eq(S.browserJobs.status, 'awaiting_verification_code'), { orderBy: desc(S.browserJobs.createdAt) });
  },
  async cancelQueued(sdb: StudentDb): Promise<number> {
    const rows = await sdb.update(S.browserJobs, { status: 'cancelled', finishedAt: new Date() }, inArray(S.browserJobs.status, ['queued', 'awaiting_verification_code']));
    return rows.length;
  },
  /** Consecutive failures for the pause-after-3 rule. */
  async recentConsecutiveFailures(sdb: StudentDb, kind: S.BrowserJob['kind']): Promise<number> {
    const rows = await sdb.select(S.browserJobs, and(eq(S.browserJobs.kind, kind), inArray(S.browserJobs.status, ['failed', 'succeeded'])), {
      orderBy: desc(S.browserJobs.createdAt),
      limit: 5,
    });
    let n = 0;
    for (const r of rows) {
      if (r.status === 'failed') n++;
      else break;
    }
    return n;
  },
};

// ---------- approvals ----------
export const approvalsRepo = {
  async create(sdb: StudentDb, input: { kind: S.Approval['kind']; summary: string; payload: S.Approval['payload']; requestedVia: Channel; agentRunId?: string | null; ttlMs?: number }): Promise<S.Approval> {
    const [row] = await sdb.insert(S.approvals, {
      kind: input.kind,
      summary: input.summary,
      payload: input.payload,
      requestedVia: input.requestedVia,
      agentRunId: input.agentRunId ?? null,
      status: 'pending',
      expiresAt: new Date(Date.now() + (input.ttlMs ?? 48 * 3600 * 1000)),
    });
    if (!row) throw new Error('approval insert failed');
    return row;
  },
  async pending(sdb: StudentDb): Promise<S.Approval[]> {
    return sdb.select(S.approvals, and(eq(S.approvals.status, 'pending'), gt(S.approvals.expiresAt, new Date())), { orderBy: desc(S.approvals.createdAt) });
  },
  async answer(sdb: StudentDb, id: string, input: { approve: boolean; via: Channel; answerText?: string | null }): Promise<S.Approval> {
    const [row] = await sdb.update(
      S.approvals,
      { status: input.approve ? 'approved' : 'rejected', answeredVia: input.via, answeredAt: new Date(), answerText: input.answerText ?? null, updatedAt: new Date() },
      and(eq(S.approvals.id, id), eq(S.approvals.status, 'pending')),
    );
    if (!row) throw new Error('approval not pending');
    return row;
  },
  async expireStale(sdb: StudentDb): Promise<number> {
    const rows = await sdb.update(S.approvals, { status: 'expired' }, and(eq(S.approvals.status, 'pending'), lt(S.approvals.expiresAt, new Date())));
    return rows.length;
  },
};
