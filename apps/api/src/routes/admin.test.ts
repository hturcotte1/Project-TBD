import { describe, expect, it } from 'vitest';
import { authHeader, createAdmin, makeTestApp } from '../testHelpers';

describe('admin', () => {
  it('403s a plain student on every admin route, and 200s an admin', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const studentHeaders = authHeader(await token(studentId));
    const admin = await createAdmin(deps);
    const adminHeaders = authHeader(admin.token);

    for (const url of ['/admin/students', '/admin/queues', '/admin/jobs', '/admin/drift', '/admin/costs']) {
      const res = await app.inject({ method: 'GET', url, headers: studentHeaders });
      expect(res.statusCode, url).toBe(403);
    }

    const students = await app.inject({ method: 'GET', url: '/admin/students', headers: adminHeaders });
    expect(students.statusCode).toBe(200);
    expect(Array.isArray(students.json())).toBe(true);
    expect(students.json().some((s: { student: { id: string } }) => s.student.id === studentId)).toBe(true);

    const queues = await app.inject({ method: 'GET', url: '/admin/queues', headers: adminHeaders });
    expect(queues.statusCode).toBe(200);
    // No redis in tests: every queue reports zero counts.
    expect(queues.json().every((q: { waiting: number }) => q.waiting === 0)).toBe(true);

    const costs = await app.inject({ method: 'GET', url: '/admin/costs', headers: adminHeaders });
    expect(costs.statusCode).toBe(200);
    expect(costs.json().students.length).toBeGreaterThan(0);
  });

  it('admin can trigger a sync for any student', async () => {
    const { app, studentId, deps } = await makeTestApp();
    const admin = await createAdmin(deps);
    const res = await app.inject({ method: 'POST', url: `/admin/students/${studentId}/sync`, headers: authHeader(admin.token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe('full_sync');
    expect(deps.enqueuer.ofName('browser.full_sync').some((j) => j.payload.studentId === studentId && j.payload.reason === 'admin')).toBe(true);
  });
});
