'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AddCustomItemForm } from '@/components/schools/add-custom-item-form';
import { ApplicationHeader } from '@/components/schools/application-header';
import { CHECKLIST_GROUP_NAMES, groupChecklistItems } from '@/components/schools/checklist-groups';
import { ChecklistSection } from '@/components/schools/checklist-section';
import { RequirementsSummary } from '@/components/schools/requirements-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 20_000;

export default function SchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const applicationQuery = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => clientApi.call('applicationGet', { params: { id: applicationId } }),
    refetchInterval: POLL_MS,
  });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6">
      <Link href="/schools" className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All schools
      </Link>

      {applicationQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : applicationQuery.isError ? (
        <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load this school — try refreshing.</p>
      ) : applicationQuery.data ? (
        <>
          <ApplicationHeader application={applicationQuery.data} timezone={timezone} />
          <RequirementsSummary requirements={applicationQuery.data.requirements} />

          <div className="space-y-5">
            {(() => {
              const groups = groupChecklistItems(applicationQuery.data.items);
              return CHECKLIST_GROUP_NAMES.map((name) => <ChecklistSection key={name} title={name} items={groups[name]} timezone={timezone} />);
            })()}
          </div>

          <AddCustomItemForm applicationId={applicationQuery.data.id} />
        </>
      ) : null}
    </div>
  );
}
