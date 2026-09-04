/**
 * Bearer-token resolution for the current request, in either auth mode.
 *
 * `AUTH_MODE=dev` reads a signed dev token straight out of the `tbd_dev_session` cookie (set by
 * `/dev/login`). `AUTH_MODE=clerk` asks Clerk for the current session's JWT. Server components and
 * route handlers should call `getToken()` / `requireToken()`; never import this from a client
 * component (it uses `next/headers`, which only works on the server).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type AuthMode = 'dev' | 'clerk';

export const AUTH_MODE: AuthMode = process.env.AUTH_MODE === 'clerk' ? 'clerk' : 'dev';
export const DEV_SESSION_COOKIE = 'tbd_dev_session';

/** Where an unauthenticated visitor should land. */
export function loginPath(): string {
  return AUTH_MODE === 'clerk' ? '/sign-in' : '/dev/login';
}

/** The bearer token for the current request, or null if the visitor isn't signed in. */
export async function getToken(): Promise<string | null> {
  if (AUTH_MODE === 'clerk') {
    const { auth } = await import('@clerk/nextjs/server');
    const session = await auth();
    return session.getToken();
  }
  const store = await cookies();
  return store.get(DEV_SESSION_COOKIE)?.value ?? null;
}

/** Server components: redirect to login when signed out, otherwise return the bearer token. */
export async function requireToken(): Promise<string> {
  const token = await getToken();
  if (!token) redirect(loginPath());
  return token;
}
