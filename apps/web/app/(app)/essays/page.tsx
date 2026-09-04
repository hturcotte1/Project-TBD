'use client';

import type { EssayDto } from '@tbd/shared/api';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { EssayCard } from '@/components/essays/essay-card';
import { EmptyState } from '@/components/layout/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 30_000;

/** Nearest due date first (essays with no due date last); ties broken by school name. */
function sortEssays(essays: EssayDto[]): EssayDto[] {
  return [...essays].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return (a.school_name ?? '').localeCompare(b.school_name ?? '');
  });
}

export default function EssaysPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const essaysQuery = useQuery({ queryKey: ['essays'], queryFn: () => clientApi.call('essaysList'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const essays = sortEssays(essaysQuery.data ?? []);

  return (
    <div className="pb-8">
      <PageHeader title="Essays" description="Every essay across your schools, and the personal essay you write once." />
      <div className="space-y-3 px-4 py-5 sm:px-6">
        {essaysQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : essaysQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load your essays — try refreshing.</p>
        ) : essays.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No essays yet"
            description="Once you add a school with supplement essays, or connect Common App and sync, they'll show up here — including the one personal essay shared across every school."
          />
        ) : (
          essays.map((essay) => <EssayCard key={essay.id} essay={essay} timezone={timezone} />)
        )}
      </div>
    </div>
  );
}
