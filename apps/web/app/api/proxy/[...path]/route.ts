import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/auth';

/**
 * Forwards every request under `/api/proxy/*` to `apps/api`, attaching the current visitor's
 * bearer token so it never has to reach the browser. Used by client components (`lib/api.client.ts`)
 * because a Client Component cannot call `next/headers`-backed auth directly. Streams method, path,
 * query string, headers (content-type — including multipart boundaries for uploads — and accept),
 * and body straight through in both directions; this route authenticates itself (401 if signed out),
 * which is why `middleware.ts` leaves `/api/proxy/*` out of its own redirect logic.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

type FetchInitWithDuplex = RequestInit & { duplex?: 'half' };

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ code: 'unauthorized', message: 'Not signed in' }, { status: 401 });
  }

  const target = new URL(`/${path.map(encodeURIComponent).join('/')}`, API_URL);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = req.headers.get('accept');
  headers.set('accept', accept ?? 'application/json');
  headers.set('authorization', `Bearer ${token}`);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null;
  const init: FetchInitWithDuplex = {
    method: req.method,
    headers,
    cache: 'no-store',
    ...(hasBody ? { body: req.body, duplex: 'half' } : {}),
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ code: 'upstream_unreachable', message: 'Could not reach the API' }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  // Node's fetch already decoded any compressed body; forwarding these would desync the client.
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return proxy(req, (await ctx.params).path);
}
