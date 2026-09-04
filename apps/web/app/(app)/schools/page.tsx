'use client';

import { useQuery } from '@tanstack/react-query';
import { School as SchoolIcon } from 'lucide-react';
import { useState } from 'react';
import { AddSchoolDialog } from '@/components/schools/add-school-dialog';
import { SchoolCard } from '@/components/schools/school-card';
import { SyncNowButton } from '@/components/schools/sync-now-button';
import { groupApplications } from '@/components/schools/sort';
import { EmptyState } from '@/components/layout/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 20_000;

export default function SchoolsPage() {
  const [addOpen, setAddOpen] = useState(false);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const applicationsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: () => clientApi.call('applicationsList'),
    refetchInterval: POLL_MS,
  });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const applications = applicationsQuery.data ?? [];
  const { active, submitted } = groupApplications(applications);
  const excludedSlugs = new Set(applications.map((a) => a.school.slug));

  return (
    <div className="pb-8">
      <PageHeader
        title="Schools"
        description="Every application, its deadline, and how far along it is."
        actions={
          <>
            <SyncNowButton />
            <Button size="sm" onClick={() => setAddOpen(true)}>
              Add school
            </Button>
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 sm:px-6">
        {applicationsQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : applicationsQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load your schools — try refreshing.</p>
        ) : applications.length === 0 ? (
          <EmptyState
            icon={SchoolIcon}
            title="No schools yet"
            description="Add a school to start tracking its deadline and checklist — search our dataset or add one we don't have."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Add school
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {active.map((application) => (
                <SchoolCard key={application.id} application={application} timezone={timezone} />
              ))}
            </div>
            {submitted.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Submitted</h2>
                {submitted.map((application) => (
                  <SchoolCard key={application.id} application={application} timezone={timezone} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <AddSchoolDialog open={addOpen} onOpenChange={setAddOpen} excludedSlugs={excludedSlugs} timezone={timezone} />
    </div>
  );
}
