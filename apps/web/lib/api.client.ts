'use client';

/**
 * Client-side typed API caller. Mirrors `createApiClient` from `@apogee/shared/api` but always hits
 * `/api/proxy/*` (same origin, no token in the browser) instead of the API directly.
 */
import { ApiError, DocumentDto, api, buildPath } from '@apogee/shared/api';
import type { RouteInput, RouteKey, RouteResponse } from '@apogee/shared/api';
import type { DocumentKind } from '@apogee/shared/domain';

interface ErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

function parseErrorBody(text: string): ErrorBody {
  try {
    return JSON.parse(text) as ErrorBody;
  } catch {
    return { message: text };
  }
}

async function call<K extends RouteKey>(key: K, input: RouteInput<K> = {}): Promise<RouteResponse<K>> {
  const def = api[key];
  const path = buildPath(def.path, input.params as Record<string, string> | undefined);
  const url = new URL(`/api/proxy${path}`, window.location.origin);
  for (const [k, v] of Object.entries((input.query ?? {}) as Record<string, unknown>)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  let body: string | undefined;
  if (def.method !== 'GET' && input.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(input.body);
  }

  const res = await fetch(url.toString(), { method: def.method, headers, body, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    const parsed = parseErrorBody(text);
    throw new ApiError(res.status, parsed.code ?? 'error', parsed.message ?? res.statusText, parsed.details);
  }
  if (key === 'timelineIcs') return text as RouteResponse<K>;
  return (text ? JSON.parse(text) : null) as RouteResponse<K>;
}

/**
 * Uploads a file to `POST /documents` (multipart). That route is intentionally outside the zod
 * contract — a multipart body doesn't fit a single zod body schema — but is implemented by
 * apps/api per ARCHITECTURE.md. `kind` matches the `documents.kind` enum (`transcript`, `resume`, ...).
 */
async function upload(kind: DocumentKind, file: File): Promise<DocumentDto> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const res = await fetch('/api/proxy/documents', { method: 'POST', body: form, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    const parsed = parseErrorBody(text);
    throw new ApiError(res.status, parsed.code ?? 'error', parsed.message ?? res.statusText, parsed.details);
  }
  return DocumentDto.parse(text ? JSON.parse(text) : null);
}

export const clientApi = { call, upload };
