import { api, buildPath, type RouteInput, type RouteKey, type RouteResponse } from './contract';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Called per request; returns the bearer token (Clerk session JWT or dev token). */
  getToken: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
  /** Extra headers, e.g. a request id. */
  headers?: Record<string, string>;
}

/** Typed client over the contract. Used by the web app (server side) and by tests. */
export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  async function call<K extends RouteKey>(key: K, input: RouteInput<K> = {}): Promise<RouteResponse<K>> {
    const def = api[key];
    const url = new URL(buildPath(def.path, input.params as Record<string, string> | undefined), opts.baseUrl);
    for (const [k, v] of Object.entries((input.query ?? {}) as Record<string, unknown>)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const token = await opts.getToken();
    const headers: Record<string, string> = { accept: 'application/json', ...(opts.headers ?? {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    let body: string | undefined;
    if (def.method !== 'GET' && input.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(input.body);
    }
    const init = { method: def.method, headers, body, cache: 'no-store' } as RequestInit;
    const res = await f(url.toString(), init);
    const text = await res.text();
    if (!res.ok) {
      let parsed: { code?: string; message?: string; details?: unknown } = {};
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        parsed = { message: text };
      }
      throw new ApiError(res.status, parsed.code ?? 'error', parsed.message ?? res.statusText, parsed.details);
    }
    if (key === 'timelineIcs') return text as RouteResponse<K>;
    return (text ? JSON.parse(text) : null) as RouteResponse<K>;
  }
  return { call };
}
export type ApiClient = ReturnType<typeof createApiClient>;
