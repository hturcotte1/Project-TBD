'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { RecommenderCard } from '@/components/recommenders/recommender-card';
import { RecommenderFormDialog } from '@/components/recommenders/recommender-form-dialog';
import { EmptyState } from '@/components/layout/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

export default function RecommendersPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const recommendersQuery = useQuery({ queryKey: ['recommenders'], queryFn: () => clientApi.call('recommendersList') });
  const applicationsQuery = useQuery({ queryKey: ['applications'], queryFn: () => clientApi.call('applicationsList') });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const applications = applicationsQuery.data ?? [];

  return (
    <div className="pb-8">
      <PageHeader
        title="Recommenders"
        description="Teachers and counselors writing on your behalf, and where each one stands per school."
        actions={<RecommenderFormDialog applications={applications} />}
      />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {recommendersQuery.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : recommendersQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load recommenders — try refreshing.</p>
        ) : recommendersQuery.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No recommenders yet"
            description="Recommenders show up here automatically once Common App syncs your invited teachers and counselor, or you can add one yourself with the button above."
          />
        ) : (
          <div className="space-y-4">
            {recommendersQuery.data.map((recommender) => (
              <RecommenderCard key={recommender.id} recommender={recommender} applications={applications} timezone={timezone} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
