import { eq } from 'drizzle-orm';
import * as S from '@tbd/shared/db/schema';
import { createTestStudent } from '@tbd/shared/testing';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('applications', () => {
  it('creates an application for a known dataset slug with a real checklist', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const res = await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: 'target' } });
    expect(res.statusCode).toBe(200);
    const dto = res.json();
    expect(dto.school.slug).toBe('purdue');
    expect(dto.plan).toBe('EA');
    expect(dto.counts.total).toBeGreaterThan(0);
    expect(dto.common_app_url).toContain('purdue');
  });

  it('creates an application for a free-text school name, flagged unverified', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const res = await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_name: 'My Made Up College', plan: 'RD', self_assessment: null } });
    expect(res.statusCode).toBe(200);
    const dto = res.json();
    expect(dto.school.name).toBe('My Made Up College');

    const schoolRow = await deps.db.select().from(S.schools).where(eq(S.schools.id, dto.school.id)).limit(1);
    const reqRow = await deps.db.select().from(S.schoolRequirements).where(eq(S.schoolRequirements.schoolId, schoolRow[0]!.id)).limit(1);
    expect(reqRow[0]?.needsVerification).toBe(true);
  });

  it('rejects a duplicate application with 409', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });
    const res = await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('already_exists');
  });

  it('changePlan re-resolves the deadline when updating plan', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const created = (await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } })).json();

    const updated = await app.inject({ method: 'PATCH', url: `/applications/${created.id}`, headers, payload: { plan: 'RD' } });
    expect(updated.statusCode).toBe(200);
    const dto = updated.json();
    expect(dto.plan).toBe('RD');
    expect(dto.deadline).not.toBe(created.deadline);
  });

  it('deletes an application', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const created = (await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } })).json();
    const del = await app.inject({ method: 'DELETE', url: `/applications/${created.id}`, headers });
    expect(del.statusCode).toBe(200);
    const get = await app.inject({ method: 'GET', url: `/applications/${created.id}`, headers });
    expect(get.statusCode).toBe(404);
  });

  it('cross-student: student B cannot read or update student A application (404)', async () => {
    const { app, studentId: aId, token, deps } = await makeTestApp();
    const headersA = authHeader(await token(aId));
    const created = (await app.inject({ method: 'POST', url: '/applications', headers: headersA, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } })).json();

    const b = await createTestStudent(deps.db, { phoneE164: null });
    const headersB = authHeader(await token(b.id));

    const getRes = await app.inject({ method: 'GET', url: `/applications/${created.id}`, headers: headersB });
    expect(getRes.statusCode).toBe(404);

    const patchRes = await app.inject({ method: 'PATCH', url: `/applications/${created.id}`, headers: headersB, payload: { notes: 'hijacked' } });
    expect(patchRes.statusCode).toBe(404);

    const delRes = await app.inject({ method: 'DELETE', url: `/applications/${created.id}`, headers: headersB });
    expect(delRes.statusCode).toBe(404);

    // Student A can still see it fine.
    const getA = await app.inject({ method: 'GET', url: `/applications/${created.id}`, headers: headersA });
    expect(getA.statusCode).toBe(200);
  });
});
