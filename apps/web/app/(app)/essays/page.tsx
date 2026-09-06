'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { EssaysTable } from '@/components/essays/essays-table';
import { sortEssays } from '@/components/essays/sort';
import { Button, Empty, ErrorNote, PageTitle } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 30_000;

export default function EssaysPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const essaysQuery = useQuery({ queryKey: ['essays'], queryFn: () => clientApi.call('essaysList'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const essays = sortEssays(essaysQuery.data ?? []);

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — essays has no numeral of its own to render in it. A hidden span still warms the
          font file so the browser doesn't leave it entirely unloaded (same warm-up Timeline and
          Schools do for their own pages). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle>Essays</PageTitle>

      {essaysQuery.isError ? (
        <ErrorNote>
          Could not load your essays.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => essaysQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : essaysQuery.data && essays.length === 0 ? (
        <Empty
          sentence="No essays yet. They appear once a school with supplements is added or Common App syncs."
          action={{ label: 'Add a school', href: '/schools?add=1' }}
        />
      ) : essaysQuery.data ? (
        <EssaysTable essays={essays} timezone={timezone} />
      ) : null}
    </div>
  );
}
