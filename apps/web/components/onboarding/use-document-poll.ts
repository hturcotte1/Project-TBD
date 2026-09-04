'use client';

import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/lib/api.client';

const TERMINAL_STATUSES = new Set(['done', 'failed', 'not_applicable']);

/** Polls `GET /documents/:id` every 1.5s until extraction reaches a terminal status. */
export function useDocumentPoll(documentId: string | null) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: () => clientApi.call('documentGet', { params: { id: documentId as string } }),
    enabled: documentId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_STATUSES.has(query.state.data.extraction_status) ? false : 1500),
  });
}
