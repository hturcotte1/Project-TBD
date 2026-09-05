import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as S from '../schema';
import { closeTestDb, createTestSchool, createTestStudent, getTestDb, truncateAll } from '../../testing/db';
import { AuthorizationError, scoped } from './scoped';
import { appendAudit, conversationsRepo, credentialsRepo, messagesRepo, nudgesRepo, studentsRepo } from './core';
import { generateKeyBase64, parseKeyRing } from '../../crypto/credentials';

describe('StudentDb row-level authorization', () => {
  beforeEach(async () => truncateAll(await getTestDb()));
  afterAll(closeTestDb);

  it('a student can only read, update, and delete their own rows', async () => {
    const db = await getTestDb();
    const alice = await createTestStudent(db, { firstName: 'Alice' });
    const bob = await createTestStudent(db, { firstName: 'Bob' });
    const school = await createTestSchool(db);
    const aliceDb = scoped(db, alice.id);
    const bobDb = scoped(db, bob.id);

    const [aliceApp] = await aliceDb.insert(S.applications, { schoolId: school.id, plan: 'EA', deadline: '2026-11-01' });
    const [bobApp] = await bobDb.insert(S.applications, { schoolId: school.id, plan: 'RD', deadline: '2027-01-05' });
    expect(aliceApp && bobApp).toBeTruthy();

    // reads
    expect((await aliceDb.select(S.applications)).map((a) => a.id)).toEqual([aliceApp!.id]);
    expect(await aliceDb.selectOne(S.applications, eq(S.applications.id, bobApp!.id))).toBeNull();
    await expect(aliceDb.requireOne(S.applications, eq(S.applications.id, bobApp!.id))).rejects.toBeInstanceOf(AuthorizationError);
    expect(await aliceDb.count(S.applications)).toBe(1);

    // updates by id cannot cross students
    const updated = await aliceDb.update(S.applications, { notes: 'mine' }, eq(S.applications.id, bobApp!.id));
    expect(updated).toHaveLength(0);
    const bobRow = await bobDb.selectOne(S.applications, eq(S.applications.id, bobApp!.id));
    expect(bobRow?.notes).toBe('');

    // insert forces the scope even if a caller smuggles a studentId
    const [smuggled] = await aliceDb.insert(S.applicationItems, {
      studentId: bob.id,
      applicationId: aliceApp!.id,
      ruleKey: 'custom:x',
      kind: 'custom',
      title: 'x',
      source: 'student',
    } as unknown as Omit<S.NewApplicationItem, 'studentId'>);
    expect(smuggled?.studentId).toBe(alice.id);

    // deletes
    const deleted = await aliceDb.delete(S.applications, eq(S.applications.id, bobApp!.id));
    expect(deleted).toHaveLength(0);
    expect(await bobDb.count(S.applications)).toBe(1);
  });

  it('rejects an empty scope', async () => {
    const db = await getTestDb();
    expect(() => scoped(db, '')).toThrow(AuthorizationError);
  });

  it('credentials are encrypted at rest, status never exposes ciphertext, and disconnect deletes the row', async () => {
    const db = await getTestDb();
    const s = await createTestStudent(db);
    const sdb = scoped(db, s.id);
    const ring = parseKeyRing(`1:${generateKeyBase64()}`, 1);
    await credentialsRepo.store(sdb, ring, 'common_app', 'kid@example.com', 'p@ssw0rd');
    const raw = await db.select().from(S.credentials);
    expect(raw[0]?.ciphertext.toString('utf8')).not.toContain('p@ssw0rd');
    const status = await credentialsRepo.status(sdb, 'common_app');
    expect(status).toMatchObject({ provider: 'common_app', username: 'kid@example.com', status: 'active' });
    expect(Object.keys(status ?? {})).not.toContain('ciphertext');
    const dec = await credentialsRepo.decryptForWorker(sdb, ring, 'common_app');
    expect(dec?.secret).toBe('p@ssw0rd');
    // another student cannot decrypt
    const other = await createTestStudent(db);
    expect(await credentialsRepo.decryptForWorker(scoped(db, other.id), ring, 'common_app')).toBeNull();
    // session storage round-trip
    await credentialsRepo.storeSession(sdb, ring, 'common_app', '{"cookies":[]}');
    expect((await credentialsRepo.decryptForWorker(sdb, ring, 'common_app'))?.session).toBe('{"cookies":[]}');
    expect(await credentialsRepo.remove(sdb, 'common_app')).toBe(true);
    expect(await db.select().from(S.credentials)).toHaveLength(0);
  });

  it('conversations, messages, nudges and audit are scoped', async () => {
    const db = await getTestDb();
    const s = await createTestStudent(db);
    const other = await createTestStudent(db);
    const sdb = scoped(db, s.id);
    const conv = await conversationsRepo.getOrCreate(sdb, 'main');
    expect((await conversationsRepo.getOrCreate(sdb, 'main')).id).toBe(conv.id);
    await messagesRepo.append(sdb, { conversationId: conv.id, channel: 'imessage', direction: 'inbound', body: 'hi', providerMessageId: 'pm1' });
    await messagesRepo.append(sdb, { conversationId: conv.id, channel: 'imessage', direction: 'outbound', body: 'hey' });
    expect((await messagesRepo.recent(sdb, conv.id)).map((m) => m.body)).toEqual(['hi', 'hey']);
    expect(await messagesRepo.recent(scoped(db, other.id), conv.id)).toHaveLength(0);

    await nudgesRepo.recordSent(sdb, { kind: 'deadline_countdown', triggerKey: 'k1' });
    await nudgesRepo.recordSent(sdb, { kind: 'deadline_countdown', triggerKey: 'k1' }); // idempotent
    expect(await nudgesRepo.wasSent(sdb, 'k1')).toBe(true);
    expect(await nudgesRepo.wasSent(scoped(db, other.id), 'k1')).toBe(false);

    const entry = await appendAudit(sdb, { actor: 'agent', action: 'test' });
    expect(entry.studentId).toBe(s.id);
  });

  it('grants and revokes admin from ADMIN_EMAILS on every login', async () => {
    const db = await getTestDb();
    const a = await studentsRepo.upsertFromAuth(db, { authUserId: 'dev:coach', email: 'coach@example.com', isAdmin: true });
    expect(a.role).toBe('admin');
    const b = await studentsRepo.upsertFromAuth(db, { authUserId: 'dev:coach', email: 'coach@example.com', isAdmin: false });
    expect(b.id).toBe(a.id);
    expect(b.role).toBe('student');
  });
});
