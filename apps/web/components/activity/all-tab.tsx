'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Activity as ActivityIcon, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AuditEntryRow } from '@/components/activity/audit-entry-row';
import { EmptyState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 20_000;
const PAGE_SIZE = 50;

/** The "All" tab: everything the agent did and saw, newest first, loading more as you scroll. */
export function AllActivityTab() {
  const query = useInfiniteQuery({
    queryKey: ['activity', 'all'],
    queryFn: ({ pageParam }) => clientApi.call('activityFeed', { query: { cursor: pageParam, limit: PAGE_SIZE } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    refetchInterval: POLL_MS,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasNextPage = query.hasNextPage;
  const isFetchingNextPage = query.isFetchingNextPage;
  const fetchNextPage = query.fetchNextPage;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load activity — try refreshing.</p>;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Nothing yet"
        description="Every sync, message, approval, and fill the agent does or sees shows up here as soon as it happens."
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <AuditEntryRow key={entry.id} entry={entry} />
      ))}
      <div ref={sentinelRef} />
      {isFetchingNextPage ? (
        <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
        </p>
      ) : hasNextPage ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
