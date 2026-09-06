'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { ActivityRow } from '@/components/activity/activity-row';
import { STREAM_FILTER_OPTIONS, filterStream, groupByDay, isStreamFilter, toStreamItems } from '@/components/activity/stream';
import type { StreamFilter } from '@/components/activity/stream';
import { Button, Empty, ErrorNote, Segmented, Table, TableBody } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 20_000;
const PAGE_SIZE = 50;
const SNAPSHOTS_LIMIT = 100;

export function ActivityStream() {
  const router = useRouter();
  const [filter, setFilterState] = useState<StreamFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Same convention as the Timeline page: the URL is the source of truth, read once on mount so
  // a shared link or a screenshot's own navigation lands on the right segment, without forcing a
  // Suspense boundary via useSearchParams.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('filter');
    if (value && isStreamFilter(value)) setFilterState(value);
  }, []);

  function setFilter(next: string) {
    if (!isStreamFilter(next)) return;
    setFilterState(next);
    const params = new URLSearchParams(window.location.search);
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    router.replace(`/activity${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  const feedQuery = useInfiniteQuery({
    queryKey: ['activity', 'feed'],
    queryFn: ({ pageParam }) => clientApi.call('activityFeed', { query: { cursor: pageParam, limit: PAGE_SIZE } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    refetchInterval: POLL_MS,
  });
  const snapshotsQuery = useQuery({
    queryKey: ['activity', 'snapshots'],
    queryFn: () => clientApi.call('snapshotsList', { query: { limit: SNAPSHOTS_LIMIT } }),
    refetchInterval: POLL_MS,
  });

  const loaded = feedQuery.data !== undefined && snapshotsQuery.data !== undefined;
  const entries = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const items = toStreamItems(entries, snapshotsQuery.data ?? []);
  const filtered = filterStream(items, filter);
  const groups = groupByDay(filtered, (item) => item.created_at, timezone);

  const hasError = feedQuery.isError || snapshotsQuery.isError;

  return (
    <div className="flex flex-col gap-6">
      <Segmented aria-label="Filter activity" value={filter} onValueChange={setFilter} options={STREAM_FILTER_OPTIONS} />

      {hasError ? (
        <ErrorNote>
          Could not load activity.{' '}
          <Button
            variant="text"
            className="h-auto px-0"
            onClick={() => {
              void feedQuery.refetch();
              void snapshotsQuery.refetch();
            }}
          >
            Try again
          </Button>
        </ErrorNote>
      ) : loaded && items.length === 0 ? (
        <Empty sentence="Nothing yet. Activity appears after the first sync." action={{ label: 'Sync now', href: '/schools' }} />
      ) : loaded ? (
        <div className="flex flex-col gap-4">
          {filtered.length === 0 ? (
            <p className="text-14 text-fg-2">Nothing matches this filter yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  {groups.map((group) => (
                    <Fragment key={group.dateKey}>
                      <tr>
                        <td colSpan={3} className="pb-1 pt-4 text-12 text-fg-2">
                          {group.label}
                        </td>
                      </tr>
                      {group.items.map((item) => (
                        <ActivityRow
                          key={item.id}
                          item={item}
                          timezone={timezone}
                          expanded={expandedId === item.id}
                          onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
                        />
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {feedQuery.hasNextPage ? (
            <div>
              <Button variant="text" loading={feedQuery.isFetchingNextPage} onClick={() => void feedQuery.fetchNextPage()}>
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
