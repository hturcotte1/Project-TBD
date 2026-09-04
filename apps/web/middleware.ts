import { type NextFetchEvent, type NextMiddleware, type NextRequest, NextResponse } from 'next/server';

/**
 * Route protection. Everything is gated except `/dev/*`, `/sign-in`, `/sign-up`, `/privacy`, and
 * `/api/proxy/*` (which authenticates itself per-request and returns 401 rather than redirecting).
 *
 * `AUTH_MODE=dev` is a cheap presence check on the session cookie — real verification happens on
 * every request in `apps/api`, which checks the token's HMAC signature. `AUTH_MODE=clerk` defers
 * entirely to `clerkMiddleware`, imported lazily so the app builds and runs in dev mode with zero
 * Clerk keys configured.
 */
const AUTH_MODE = process.env.AUTH_MODE === 'clerk' ? 'clerk' : 'dev';
const DEV_SESSION_COOKIE = 'tbd_dev_session';

const PUBLIC_PREFIXES = ['/dev', '/sign-in', '/sign-up', '/privacy', '/api/proxy', '/api/vcard'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function devMiddleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

let clerkHandlerPromise: Promise<NextMiddleware> | null = null;

/** Built only when AUTH_MODE=clerk, and only on first use, so `@clerk/nextjs/server`'s module-level
 * key checks never run for dev-mode deployments. */
async function getClerkHandler(): Promise<NextMiddleware> {
  clerkHandlerPromise ??= (async () => {
    const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
    const isPublicRoute = createRouteMatcher(PUBLIC_PREFIXES.map((prefix) => `${prefix}(.*)`));
    return clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) await auth.protect();
    });
  })();
  return clerkHandlerPromise;
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (AUTH_MODE === 'clerk') {
    const handler = await getClerkHandler();
    return handler(req, event);
  }
  return devMiddleware(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
