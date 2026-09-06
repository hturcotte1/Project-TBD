'use client';

import type { TimelineEntryDto } from '@apogee/shared/api';
import { localDate } from '@apogee/shared/time';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AgendaTable } from '@/components/timeline/agenda-table';
import { KIND_FILTER_OPTIONS, isTimelineKind, type TimelineKindFilter } from '@/components/timeline/kind-meta';
import { prefersReducedMotion } from '@/components/timeline/reduced-motion';
import { RunwayView } from '@/components/timeline/runway-view';
import { Button, Empty, ErrorNote, PageTitle, Segmented } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 60_000;

export default function TimelinePage() {
  const router = useRouter();
  const [activeKind, setActiveKindState] = useState<TimelineKindFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  // The URL is the source of truth for the filter (so a shared link or a screenshot's own
  // navigation lands on the right segment), read once on mount rather than via useSearchParams —
  // that hook forces a Suspense boundary the rest of this app's client pages don't use either.
  useEffect(() => {
    const kind = new URLSearchParams(window.location.search).get('kind');
    if (kind && isTimelineKind(kind)) setActiveKindState(kind);
  }, []);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timelineQuery = useQuery({ queryKey: ['timeline'], queryFn: () => clientApi.call('timeline'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const today = useMemo(() => localDate(new Date(), timezone), [timezone]);
  const entries: TimelineEntryDto[] = timelineQuery.data ?? [];
  const filtered = useMemo(
    () => (activeKind === 'all' ? entries : entries.filter((entry) => entry.kind === activeKind)),
    [entries, activeKind],
  );

  function setActiveKind(next: string) {
    setActiveKindState(next as TimelineKindFilter);
    const params = new URLSearchParams(window.location.search);
    if (next === 'all') params.delete('kind');
    else params.set('kind', next);
    router.replace(`/timeline${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    // A date in an earlier month than today's is in a collapsed past group — open it so the row
    // just selected actually exists in the DOM for the scroll below to find.
    if (date.slice(0, 7) < today.slice(0, 7)) setPastExpanded(true);
  }

  useEffect(() => {
    if (!selectedDate) return;
    const row = document.querySelector<HTMLElement>(`[data-date="${CSS.escape(selectedDate)}"]`);
    row?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }, [selectedDate, pastExpanded]);

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — this page has no numeral of its own to render in it. A hidden span still warms
          the font file so it's not left completely unloaded by the browser (matching the same
          warm-up SchoolsPage does for its own count-face numerals). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle
        actions={
          <Button variant="text" asChild>
            <a href="/api/proxy/timeline.ics" download="apogee-timeline.ics">
              <CalendarPlus /> Export .ics
            </a>
          </Button>
        }
      >
        Timeline
      </PageTitle>

      {timelineQuery.isError ? (
        <ErrorNote>
          Could not load your timeline.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => timelineQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : timelineQuery.data && entries.length === 0 ? (
        <Empty
          sentence="Nothing on the timeline yet. Add a school and its deadlines land here."
          action={{ label: 'Add a school', href: '/schools?add=1' }}
        />
      ) : timelineQuery.data ? (
        <div className="flex flex-col gap-6">
          <RunwayView entries={filtered} today={today} timezone={timezone} onSelectDate={handleSelectDate} />

          <Segmented aria-label="Filter by kind" value={activeKind} onValueChange={setActiveKind} options={KIND_FILTER_OPTIONS} />

          {filtered.length === 0 ? (
            <p className="text-14 text-fg-2">No entries of that kind.</p>
          ) : (
            <AgendaTable
              entries={filtered}
              today={today}
              timezone={timezone}
              selectedDate={selectedDate}
              pastExpanded={pastExpanded}
              onExpandPast={() => setPastExpanded(true)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
