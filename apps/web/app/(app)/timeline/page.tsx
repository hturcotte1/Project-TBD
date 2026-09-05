'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { KindFilterChips } from '@/components/timeline/kind-filter-chips';
import { TIMELINE_KINDS, type TimelineKind } from '@/components/timeline/kind-meta';
import { MonthCalendar } from '@/components/timeline/month-calendar';
import { TimelineList } from '@/components/timeline/timeline-list';
import { EmptyState } from '@/components/layout/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 60_000;

export default function TimelinePage() {
  const [activeKinds, setActiveKinds] = useState<Set<TimelineKind>>(() => new Set(TIMELINE_KINDS));

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timelineQuery = useQuery({ queryKey: ['timeline'], queryFn: () => clientApi.call('timeline'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const entries = timelineQuery.data ?? [];
  const filtered = useMemo(() => entries.filter((entry) => activeKinds.has(entry.kind)), [entries, activeKinds]);

  function toggleKind(kind: TimelineKind) {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Timeline"
        description="Every deadline across your schools, in one place."
        actions={
          <a
            href="/api/proxy/timeline.ics"
            download="apogee-timeline.ics"
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Export .ics
          </a>
        }
      />
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <KindFilterChips active={activeKinds} onToggle={toggleKind} />

        {timelineQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : timelineQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load your timeline — try refreshing.</p>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="Nothing on your timeline yet"
            description="Deadlines show up here once you add a school on the Schools page — application deadlines, item due dates, and financial aid dates all land on this calendar."
          />
        ) : (
          <>
            <MonthCalendar entries={filtered} timezone={timezone} />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries match your filters.</p>
            ) : (
              <TimelineList entries={filtered} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
