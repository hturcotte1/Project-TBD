import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('timeline', () => {
  it('lists application deadlines and serves an ICS export', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });

    const timeline = await app.inject({ method: 'GET', url: '/timeline', headers });
    expect(timeline.statusCode).toBe(200);
    const entries = timeline.json();
    expect(entries.some((e: { kind: string }) => e.kind === 'application_deadline')).toBe(true);

    const ics = await app.inject({ method: 'GET', url: '/timeline.ics', headers });
    expect(ics.statusCode).toBe(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.body).toContain('BEGIN:VCALENDAR');
    expect(ics.body).toContain('BEGIN:VEVENT');
  });
});
