import { eq } from 'drizzle-orm';
import { scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { buildAccountExport, deleteAccount } from '@apogee/shared/services';
import { createTestStudent } from '@apogee/shared/testing';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('settings', () => {
  it('gets and updates settings, rejecting a phone already used by another student', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const get = await app.inject({ method: 'GET', url: '/settings', headers });
    expect(get.statusCode).toBe(200);
    expect(get.json().agent_name).toBe(deps.env.AGENT_NAME);

    const update = await app.inject({ method: 'PUT', url: '/settings', headers, payload: { timezone: 'America/New_York', nudge_intensity: 'intense' } });
    expect(update.statusCode).toBe(200);
    expect(update.json().timezone).toBe('America/New_York');
    expect(update.json().nudge_intensity).toBe('intense');

    const other = await createTestStudent(deps.db, { phoneE164: '+15551230000' });
    const conflict = await app.inject({ method: 'PUT', url: '/settings', headers, payload: { phone_e164: '+15551230000' } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe('phone_in_use');
    void other;
  });
});

describe('account export', () => {
  it('queues an export and the download reflects run readiness', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const queued = await app.inject({ method: 'POST', url: '/account/export', headers });
    expect(queued.statusCode).toBe(200);
    const { run_id } = queued.json();
    expect(deps.enqueuer.ofName('maintenance.export_data').some((j) => j.payload.runId === run_id)).toBe(true);

    const notReady = await app.inject({ method: 'GET', url: `/account/export/${run_id}`, headers });
    expect(notReady.statusCode).toBe(404);
    expect(notReady.json().code).toBe('not_ready');

    // Simulate the worker finishing the export.
    const sdb = scoped(deps.db, studentId);
    const exportData = await buildAccountExport(sdb);
    await deps.db.update(S.agentRuns).set({ outcome: 'completed', metadata: { export: exportData } }).where(eq(S.agentRuns.id, run_id));

    const ready = await app.inject({ method: 'GET', url: `/account/export/${run_id}`, headers });
    expect(ready.statusCode).toBe(200);
    expect(ready.json().student.id).toBe(studentId);
    expect(ready.json().credentials).toEqual([]);
  });
});

describe('account deletion', () => {
  it('deleteAccount (the maintenance job) hard-deletes the student row and its storage prefix', async () => {
    const { studentId, token, deps } = await makeTestApp();
    await token(studentId); // exercises token minting before the row disappears
    await deps.storage.put(`${studentId}/documents/keep.txt`, Buffer.from('hi'), 'text/plain');

    await deleteAccount(deps.db, studentId, deps.storage);

    const gone = await studentsRepo.findById(deps.db, studentId);
    expect(gone).toBeNull();
    expect(await deps.storage.get(`${studentId}/documents/keep.txt`)).toBeNull();
  });

  it('DELETE /account marks the student deleted immediately (401 afterwards) and enqueues maintenance.delete_account', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const res = await app.inject({ method: 'DELETE', url: '/account', headers, payload: { confirm: 'DELETE' } });
    expect(res.statusCode).toBe(200);
    expect(deps.enqueuer.ofName('maintenance.delete_account').some((j) => j.payload.studentId === studentId)).toBe(true);

    const after = await app.inject({ method: 'GET', url: '/me', headers });
    expect(after.statusCode).toBe(401);
  });
});
