'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { AcademicsSection } from '@/components/profile/academics-section';
import { ActivitiesSection } from '@/components/profile/activities-section';
import { BasicsSection } from '@/components/profile/basics-section';
import { DemographicsSection } from '@/components/profile/demographics-section';
import { GoalsSection } from '@/components/profile/goals-section';
import { NarrativeSection } from '@/components/profile/narrative-section';
import { TestScoresSection } from '@/components/profile/test-scores-section';
import { Button, ErrorNote, PageTitle, Stack } from '@/components/system';
import { clientApi } from '@/lib/api.client';

export default function ProfilePage() {
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: () => clientApi.call('profileGet') });

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — Profile has no numeral of its own. A hidden span still warms the font file so
          it's not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle>Profile</PageTitle>

      {profileQuery.isError ? (
        <ErrorNote>
          Could not load your profile.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => profileQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : profileQuery.data ? (
        <Stack>
          <BasicsSection student={profileQuery.data.student} />
          <AcademicsSection academics={profileQuery.data.profile.academics} />
          <TestScoresSection testScores={profileQuery.data.profile.test_scores} />
          <DemographicsSection demographics={profileQuery.data.profile.demographics} />
          <GoalsSection goals={profileQuery.data.profile.goals} />
          <ActivitiesSection activities={profileQuery.data.activities} />
          <NarrativeSection narrative={profileQuery.data.narrative} />
        </Stack>
      ) : null}
    </div>
  );
}
