import { type NextRequest, NextResponse } from 'next/server';
import { DEV_SESSION_COOKIE } from '@/lib/auth';

function clearAndRedirect(req: NextRequest): Response {
  const res = NextResponse.redirect(new URL('/dev/login', req.url), 303);
  res.cookies.delete(DEV_SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest): Promise<Response> {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return clearAndRedirect(req);
}
