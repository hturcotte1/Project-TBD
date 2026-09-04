import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('conversations', () => {
  it('sending a dashboard message stores it inbound and enqueues agent.inbound_message', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const send = await app.inject({ method: 'POST', url: '/conversations/main/messages', headers, payload: { body: 'hello from the dashboard' } });
    expect(send.statusCode).toBe(200);
    const message = send.json();
    expect(message.direction).toBe('inbound');
    expect(message.channel).toBe('dashboard');
    expect(message.conversation_kind).toBe('main');

    expect(deps.enqueuer.ofName('agent.inbound_message').some((j) => j.payload.messageId === message.id)).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/conversations/main/messages', headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((m: { id: string }) => m.id === message.id)).toBe(true);
  });

  it('main and interview are separate threads', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({ method: 'POST', url: '/conversations/main/messages', headers, payload: { body: 'main thread' } });
    await app.inject({ method: 'POST', url: '/conversations/interview/messages', headers, payload: { body: 'interview thread' } });

    const main = (await app.inject({ method: 'GET', url: '/conversations/main/messages', headers })).json();
    const interview = (await app.inject({ method: 'GET', url: '/conversations/interview/messages', headers })).json();
    expect(main.length).toBe(1);
    expect(interview.length).toBe(1);
    expect(main[0].body).toBe('main thread');
    expect(interview[0].body).toBe('interview thread');
  });
});
