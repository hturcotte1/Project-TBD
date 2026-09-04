'use client';

import { useQuery } from '@tanstack/react-query';
import { AcademicsSection } from '@/components/profile/academics-section';
import { ActivitiesSection } from '@/components/profile/activities-section';
import { BasicsSection } from '@/components/profile/basics-section';
import { DemographicsSection } from '@/components/profile/demographics-section';
import { GoalsSection } from '@/components/profile/goals-section';
import { NarrativeSection } from '@/components/profile/narrative-section';
import { TestScoresSection } from '@/components/profile/test-scores-section';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

export default function ProfilePage() {
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: () => clientApi.call('profileGet') });

  return (
    <div className="pb-8">
      <PageHeader title="Profile" description="Everything from onboarding, editable any time." />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {profileQuery.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : profileQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load your profile — try refreshing.</p>
        ) : (
          <>
            <BasicsSection student={profileQuery.data.student} />
            <AcademicsSection academics={profileQuery.data.profile.academics} />
            <TestScoresSection testScores={profileQuery.data.profile.test_scores} />
            <DemographicsSection demographics={profileQuery.data.profile.demographics} />
            <GoalsSection goals={profileQuery.data.profile.goals} />
            <ActivitiesSection activities={profileQuery.data.activities} />
            <NarrativeSection narrative={profileQuery.data.narrative} />
          </>
        )}
      </div>
    </div>
  );
}
