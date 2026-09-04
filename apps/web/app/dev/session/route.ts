import { createDevToken } from '@tbd/shared/auth';
import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_MODE, DEV_SESSION_COOKIE } from '@/lib/auth';

/** Sets the dev session cookie from the `/dev/login` form. Never active outside AUTH_MODE=dev. */
export async function POST(req: NextRequest): Promise<Response> {
  if (AUTH_MODE !== 'dev') {
    return NextResponse.redirect(new URL('/', req.url), 303);
  }

  const form = await req.formData();
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const redirectTo = String(form.get('redirect_url') ?? '/');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const url = new URL('/dev/login', req.url);
    url.searchParams.set('error', 'invalid_email');
    if (redirectTo.startsWith('/')) url.searchParams.set('redirect_url', redirectTo);
    return NextResponse.redirect(url, 303);
  }

  const secret = process.env.DEV_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ code: 'config_error', message: 'DEV_AUTH_SECRET is not set' }, { status: 500 });
  }

  const token = createDevToken({ sub: `dev:${email}`, email }, secret);
  const destination = redirectTo.startsWith('/') ? redirectTo : '/';
  const res = NextResponse.redirect(new URL(destination, req.url), 303);
  res.cookies.set(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  return res;
}
