import { describe, expect, it } from 'vitest';
import { createTestStudent } from '@apogee/shared/testing';
import { authHeader, makeTestApp } from '../testHelpers';

describe('items', () => {
  it('creates, updates (studentEdited), and deletes a custom item; rejects deleting a rule item', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const createRes = await app.inject({
      method: 'POST',
      url: '/items',
      headers,
      payload: { application_id: null, title: 'Call the registrar', description: 'Ask about credits', due_date: '2026-10-01' },
    });
    expect(createRes.statusCode).toBe(200);
    const item = createRes.json();
    expect(item.source).toBe('student');
    expect(item.status).toBe('missing');

    const updateRes = await app.inject({ method: 'PATCH', url: `/items/${item.id}`, headers, payload: { status: 'done', notes: 'called them' } });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.status).toBe('done');
    expect(updated.student_edited).toBe(true);
    expect(updated.completed_at).not.toBeNull();

    const delRes = await app.inject({ method: 'DELETE', url: `/items/${item.id}`, headers });
    expect(delRes.statusCode).toBe(200);

    // Create an application, delete one of its rule-sourced items should be rejected.
    const app1 = (await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } })).json();
    const list = (await app.inject({ method: 'GET', url: `/items?application_id=${app1.id}`, headers })).json();
    expect(list.length).toBeGreaterThan(0);
    const ruleItem = list[0];
    const delRule = await app.inject({ method: 'DELETE', url: `/items/${ruleItem.id}`, headers });
    expect(delRule.statusCode).toBe(400);
    expect(delRule.json().code).toBe('not_deletable');
  });

  it('cross-student: student B cannot update student A item', async () => {
    const { app, studentId: aId, token, deps } = await makeTestApp();
    const headersA = authHeader(await token(aId));
    const item = (
      await app.inject({ method: 'POST', url: '/items', headers: headersA, payload: { application_id: null, title: 'x', description: '', due_date: null } })
    ).json();

    const b = await createTestStudent(deps.db, { phoneE164: null });
    const headersB = authHeader(await token(b.id));
    const res = await app.inject({ method: 'PATCH', url: `/items/${item.id}`, headers: headersB, payload: { status: 'done' } });
    expect(res.statusCode).toBe(404);
  });
});
