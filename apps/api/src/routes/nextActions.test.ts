import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('next actions', () => {
  it('recomputes from applications/items and orders by rank', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });

    const recompute = await app.inject({ method: 'POST', url: '/next-actions/recompute', headers });
    expect(recompute.statusCode).toBe(200);
    const rows = recompute.json();
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) expect(rows[i].rank).toBeGreaterThan(rows[i - 1].rank);

    const list = await app.inject({ method: 'GET', url: '/next-actions', headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBe(rows.length);
  });

  it('marking a next action done also marks the item done', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });
    const [row] = (await app.inject({ method: 'POST', url: '/next-actions/recompute', headers })).json();

    const update = await app.inject({ method: 'PATCH', url: `/next-actions/${row.id}`, headers, payload: { status: 'done' } });
    expect(update.statusCode).toBe(200);
    expect(update.json().status).toBe('done');

    const item = await app.inject({ method: 'GET', url: `/items?application_id=${row.application_id}`, headers });
    const matched = item.json().find((i: { id: string }) => i.id === row.application_item_id);
    expect(matched.status).toBe('done');
  });

  it('snoozing a next action records a snoozed_until nudge suppression', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/applications', headers, payload: { school_slug: 'purdue', plan: 'EA', self_assessment: null } });
    const [row] = (await app.inject({ method: 'POST', url: '/next-actions/recompute', headers })).json();

    const until = new Date(Date.now() + 86_400_000).toISOString();
    const update = await app.inject({ method: 'PATCH', url: `/next-actions/${row.id}`, headers, payload: { status: 'snoozed', snoozed_until: until } });
    expect(update.statusCode).toBe(200);
    expect(update.json().status).toBe('snoozed');

    // A recompute must not resurrect a snoozed action back to open.
    const recompute = await app.inject({ method: 'POST', url: '/next-actions/recompute', headers });
    const stillSnoozed = recompute.json().every((r: { id: string }) => r.id !== row.id);
    expect(stillSnoozed).toBe(true);
  });
});
