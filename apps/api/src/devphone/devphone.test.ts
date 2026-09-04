import { eq } from 'drizzle-orm';
import { scoped } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from '../testHelpers';

describe('/dev/phone', () => {
  it('serves the HTML page', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/dev/phone' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('/dev/phone/state');
  });

  it('/dev/phone/send runs the same inbound pipeline as the webhook', async () => {
    const { app, studentId, deps } = await makeTestApp();
    const sdb = scoped(deps.db, studentId);
    await sdb.db.update(S.students).set({ phoneE164: '+15559990000' }).where(eq(S.students.id, studentId));

    const send = await app.inject({
      method: 'POST',
      url: '/dev/phone/send',
      payload: { phone: '+15559990000', body: 'hi remy' },
    });
    expect(send.statusCode).toBe(200);
    expect(deps.enqueuer.ofName('agent.inbound_message').some((j) => j.payload.studentId === studentId)).toBe(true);

    const state = await app.inject({ method: 'GET', url: `/dev/phone/state?phone=${encodeURIComponent('+15559990000')}` });
    expect(state.statusCode).toBe(200);
    const body = state.json();
    expect(body.agentName).toBe(deps.env.AGENT_NAME);
    expect(body.messages.some((m: { body: string }) => m.body === 'hi remy')).toBe(true);
  });

  it('/public/agent.vcf serves a vCard', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/public/agent.vcf' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/vcard');
    expect(res.body).toContain('BEGIN:VCARD');
  });
});
