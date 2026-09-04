import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getToken: vi.fn(),
}));

import { getToken } from '@/lib/auth';
import { DELETE, GET, POST } from './[...path]/route';

const mockedGetToken = vi.mocked(getToken);

function paramsFor(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('api proxy route', () => {
  beforeEach(() => {
    mockedGetToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 401 and never touches the network when signed out', async () => {
    mockedGetToken.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/proxy/me', { method: 'GET' });
    const res = await GET(req, paramsFor(['me']));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards method, path, and query string, and injects the bearer token', async () => {
    mockedGetToken.mockResolvedValue('test-token');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/proxy/schools?q=mich', { method: 'GET' });
    const res = await GET(req, paramsFor(['schools']));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(target.toString()).toBe('http://localhost:4000/schools?q=mich');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer test-token');
  });

  it('forwards a multi-segment path with params interpolated', async () => {
    mockedGetToken.mockResolvedValue('test-token');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/proxy/conversations/main/messages', { method: 'GET' });
    await GET(req, paramsFor(['conversations', 'main', 'messages']));

    const [target] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(target.toString()).toBe('http://localhost:4000/conversations/main/messages');
  });

  it('forwards the request body and content-type on POST, including a bearer token', async () => {
    mockedGetToken.mockResolvedValue('test-token');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/proxy/conversations/main/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'hi' }),
    });
    const res = await POST(req, paramsFor(['conversations', 'main', 'messages']));

    expect(res.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit & { duplex?: string }];
    expect(init.method).toBe('POST');
    expect(init.body).toBeDefined();
    expect(init.duplex).toBe('half');
    const headers = init.headers as Headers;
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer test-token');
  });

  it('forwards DELETE requests', async () => {
    mockedGetToken.mockResolvedValue('test-token');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/proxy/applications/abc-123', { method: 'DELETE' });
    const res = await DELETE(req, paramsFor(['applications', 'abc-123']));

    expect(res.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(target.toString()).toBe('http://localhost:4000/applications/abc-123');
    expect(init.method).toBe('DELETE');
  });

  it('returns 502 when the upstream API is unreachable', async () => {
    mockedGetToken.mockResolvedValue('test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/proxy/me', { method: 'GET' });
    const res = await GET(req, paramsFor(['me']));

    expect(res.status).toBe(502);
  });
});
