/**
 * Server-side typed API client. Use from Server Components and route handlers only — it calls
 * `apps/api` directly with the current request's bearer token, never through `/api/proxy`.
 */
import { createApiClient } from '@tbd/shared/api';
import { getToken } from '@/lib/auth';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export function serverApi() {
  return createApiClient({ baseUrl: API_URL, getToken });
}

export type ServerApi = ReturnType<typeof serverApi>;
