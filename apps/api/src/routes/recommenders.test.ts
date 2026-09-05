import { createTestStudent } from '@apogee/shared/testing';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('recommenders', () => {
  it('creates a recommender with school assignments, updates the school list, and drafts a reminder', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const purdue = (await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } })).json();
    const iu = (await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'indiana', plan: 'EA', self_assessment: null } })).json();

    const create = await app.inject({
      method: 'POST',
      url: '/recommenders',
      headers,
      payload: { name: 'Ms. Park', role: 'teacher', email: 'park@example.com', subject: 'English', application_ids: [purdue.id] },
    });
    expect(create.statusCode).toBe(200);
    const rec = create.json();
    expect(rec.assignments.length).toBe(1);
    expect(rec.assignments[0].school_name).toBe('Purdue University');

    const update = await app.inject({
      method: 'PATCH',
      url: `/recommenders/${rec.id}`,
      headers,
      payload: { invite_status: 'invited', invited_at: '2026-09-02', application_ids: [purdue.id, iu.id] },
    });
    expect(update.statusCode).toBe(200);
    const updated = update.json();
    expect(updated.invite_status).toBe('invited');
    expect(updated.assignments.length).toBe(2);

    const reminder = await app.inject({ method: 'POST', url: `/recommenders/${rec.id}/reminder-draft`, headers });
    expect(reminder.statusCode).toBe(200);
    const { run_id } = reminder.json();
    expect(deps.enqueuer.ofName('agent.reminder_draft').some((j) => j.payload.runId === run_id && j.payload.recommenderId === rec.id)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/recommenders/${rec.id}`, headers });
    expect(del.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/recommenders', headers });
    expect(list.json().length).toBe(0);
  });

  it('cross-student: student B cannot update or delete student A recommender', async () => {
    const { app, studentId: aId, token, deps } = await makeTestApp();
    const headersA = authHeader(await token(aId));
    const rec = (await app.inject({ method: 'POST', url: '/recommenders', headers: headersA, payload: { name: 'Mr. Diaz', role: 'counselor', email: null, subject: null, application_ids: [] } })).json();

    const b = await createTestStudent(deps.db, { phoneE164: null });
    const headersB = authHeader(await token(b.id));

    const patch = await app.inject({ method: 'PATCH', url: `/recommenders/${rec.id}`, headers: headersB, payload: { name: 'hijacked' } });
    expect(patch.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: `/recommenders/${rec.id}`, headers: headersB });
    expect(del.statusCode).toBe(404);
  });
});
