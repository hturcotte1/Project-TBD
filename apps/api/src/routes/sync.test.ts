import { scoped, browserJobsRepo } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('sync + credentials', () => {
  it('sync/run creates a browser job and enqueues browser.full_sync', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const res = await app.inject({ method: 'POST', url: '/sync/run', headers });
    expect(res.statusCode).toBe(200);
    const job = res.json();
    expect(job.kind).toBe('full_sync');
    expect(job.status).toBe('queued');

    const jobs = deps.enqueuer.ofName('browser.full_sync');
    expect(jobs.some((j) => j.payload.browserJobId === job.id && j.payload.reason === 'manual')).toBe(true);
  });

  it('connecting credentials stores them encrypted and queues verification; status reflects it', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const connect = await app.inject({ method: 'POST', url: '/credentials/common-app', headers, payload: { email: 'demo@example.com', password: 'hunter2' } });
    expect(connect.statusCode).toBe(200);
    expect(connect.json().kind).toBe('verify_credentials');

    const verifyJobs = deps.enqueuer.ofName('browser.verify_credentials');
    expect(verifyJobs.length).toBe(1);

    const status = await app.inject({ method: 'GET', url: '/sync/status', headers });
    expect(status.statusCode).toBe(200);
    expect(status.json().credentials.connected).toBe(true);
    expect(status.json().credentials.username).toBe('demo@example.com');

    const sdb = scoped(deps.db, studentId);
    const credRow = await sdb.selectOne(S.credentials);
    expect(credRow?.ciphertext).toBeTruthy();
    expect(credRow?.username).toBe('demo@example.com');
  });

  it('disconnecting deletes the credentials row and cancels queued jobs', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/credentials/common-app', headers, payload: { email: 'demo@example.com', password: 'hunter2' } });

    const disconnect = await app.inject({ method: 'DELETE', url: '/credentials/common-app', headers });
    expect(disconnect.statusCode).toBe(200);

    const status = await app.inject({ method: 'GET', url: '/sync/status', headers });
    expect(status.json().credentials.connected).toBe(false);

    // The queued browser_jobs row itself is cancelled (browserJobsRepo.cancelQueued).
    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.latest(sdb, 'verify_credentials');
    expect(job?.status).toBe('cancelled');
  });

  it('submitting a verification code publishes to the waiting job, and 409s with no job waiting', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const noJob = await app.inject({ method: 'POST', url: '/verification-code', headers, payload: { code: '123456' } });
    expect(noJob.statusCode).toBe(409);
    expect(noJob.json().code).toBe('no_job_waiting');

    const sdb = scoped(deps.db, studentId);
    const job = await browserJobsRepo.create(sdb, { kind: 'full_sync', provider: 'local' });
    await browserJobsRepo.update(sdb, job.id, { status: 'awaiting_verification_code' });

    const waitPromise = deps.codeChannel.waitFor(job.id, 5000);
    const submit = await app.inject({ method: 'POST', url: '/verification-code', headers, payload: { code: '654321' } });
    expect(submit.statusCode).toBe(200);
    const code = await waitPromise;
    expect(code).toBe('654321');
  });
});
