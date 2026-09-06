'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AddSchoolDrawer } from '@/components/schools/add-school-drawer';
import { DEFAULT_SCHOOL_SORT, groupApplications, sortApplicationsByColumn } from '@/components/schools/sort';
import type { SchoolSortColumn } from '@/components/schools/sort';
import { SchoolsTable } from '@/components/schools/schools-table';
import { SyncNowButton } from '@/components/schools/sync-now-button';
import { isSyncActive, needsVerificationCode } from '@/components/schools/sync-state';
import { Button, Empty, ErrorNote, PageTitle, Section } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 20_000;

export default function SchoolsPage() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sort, setSort] = useState(DEFAULT_SCHOOL_SORT);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
      setAddOpen(true);
      router.replace('/schools');
    }
    // Runs once on mount only — a later ?add=1 (e.g. the back button) is not expected to re-open it.
  }, [router]);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const applicationsQuery = useQuery({ queryKey: ['applications'], queryFn: () => clientApi.call('applicationsList'), refetchInterval: POLL_MS });
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: () => clientApi.call('itemsList', { query: {} }) });
  const syncStatusQuery = useQuery({ queryKey: ['sync-status'], queryFn: () => clientApi.call('syncStatus'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const applications = applicationsQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const { active, submitted } = groupApplications(applications);
  const sortedActive = sortApplicationsByColumn(active, sort);
  const excludedSlugs = new Set(applications.map((a) => a.school.slug));
  const syncActive = isSyncActive(syncStatusQuery.data?.last_job?.status);
  const needsCode = needsVerificationCode(meQuery.data?.sync_paused_reason);

  function handleSortChange(column: SchoolSortColumn) {
    setSort((prev) => (prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' }));
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-8">
      {/* The table's day-count numerals render in the count face (see COUNT_NUMERAL_CLASS in
          schools-table.tsx), but only once applications have loaded — this warms that font as
          part of the page's first paint instead of on the client fetch finishing, so the swap
          from the fallback face never happens where a reader would notice it. */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle
        actions={
          <>
            <SyncNowButton />
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add school
            </Button>
          </>
        }
      >
        Schools
      </PageTitle>

      {applicationsQuery.isError ? (
        <ErrorNote>
          Could not load your schools.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => applicationsQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : applicationsQuery.data && applications.length === 0 ? (
        <Empty sentence="No schools yet. Add one to start its checklist and countdown." action={{ label: 'Add school', onClick: () => setAddOpen(true) }} />
      ) : applicationsQuery.data ? (
        <div className="flex flex-col gap-8">
          <SchoolsTable
            applications={sortedActive}
            items={items}
            timezone={timezone}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            sort={sort}
            onSortChange={handleSortChange}
            syncActive={syncActive}
            needsCode={needsCode}
          />
          {submitted.length > 0 ? (
            <Section title="Submitted">
              <SchoolsTable
                applications={submitted}
                items={items}
                timezone={timezone}
                expandedId={expandedId}
                onToggleExpand={toggleExpand}
                showCompletion={false}
                syncActive={syncActive}
                needsCode={needsCode}
              />
            </Section>
          ) : null}
        </div>
      ) : null}

      <AddSchoolDrawer open={addOpen} onOpenChange={setAddOpen} excludedSlugs={excludedSlugs} timezone={timezone} />
    </div>
  );
}
