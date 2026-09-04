/** Shared mock `fetch` for Sendblue tests. Not itself a test file (no `.test.ts` suffix). */

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

export interface MockSendblueFetchOptions {
  /** HTTP statuses to return, in order, before falling through to the default success response. */
  failuresByPath?: Record<string, number[]>;
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/** Records every call and answers with realistic canned responses for send-message/-typing-indicator/-reaction. */
export function createMockSendblueFetch(options: MockSendblueFetchOptions = {}): { fetchImpl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const failureQueues = new Map<string, number[]>(Object.entries(options.failuresByPath ?? {}).map(([k, v]) => [k, [...v]]));

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = new URL(url).pathname;
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
    const headers = Object.fromEntries(Object.entries(rawHeaders).map(([k, v]) => [k.toLowerCase(), v]));
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push({ url, method: init?.method ?? 'GET', headers, body });

    const queue = failureQueues.get(path);
    if (queue && queue.length > 0) {
      const status = queue.shift() as number;
      return jsonResponse({ status: 'ERROR', message: 'mock failure' }, status);
    }

    if (path === '/api/send-message') {
      return jsonResponse(
        {
          message_handle: `mh-${calls.length}`,
          status: 'QUEUED',
          content: body?.content ?? '',
          media_url: body?.media_url ?? '',
          from_number: body?.from_number,
          number: body?.number,
        },
        200,
      );
    }
    if (path === '/api/send-typing-indicator') {
      return jsonResponse({ status: 'QUEUED', status_code: 200, error_message: null, number: body?.number }, 200);
    }
    if (path === '/api/send-reaction') {
      return jsonResponse({ status: 'OK', message: 'Reaction request sent', message_handle: body?.message_handle, reaction: body?.reaction }, 200);
    }
    return jsonResponse({ status: 'ERROR', message: 'not found' }, 404);
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}
