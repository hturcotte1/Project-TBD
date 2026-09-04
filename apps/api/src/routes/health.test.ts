import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('health', () => {
  it('GET /health is public and returns ok', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, version: expect.any(String) });
  });
});

describe('auth', () => {
  it('401s a student route with no bearer token', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('unauthorized');
  });

  it('401s an invalid bearer token', async () => {
    const { app } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/me', headers: authHeader('not-a-real-token') });
    expect(res.statusCode).toBe(401);
  });

  it('resolves the student and returns 200 with a valid dev token', async () => {
    const { app, studentId, token } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/me', headers: authHeader(await token(studentId)) });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(studentId);
  });

  it('403s an admin-only route for a plain student', async () => {
    const { app, studentId, token } = await makeTestApp();
    const res = await app.inject({ method: 'GET', url: '/admin/students', headers: authHeader(await token(studentId)) });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });
});
