'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { CaretLeft } from '@phosphor-icons/react';
import { AddItemInput } from '@/components/schools/add-item-input';
import { ChecklistTable } from '@/components/schools/checklist-table';
import { completionGroups } from '@/components/schools/completion';
import { requirementsToSentences } from '@/components/schools/requirements-prose';
import { SchoolHeader } from '@/components/schools/school-header';
import { CHECKLIST_GROUP_NAMES, groupChecklistItems } from '@/components/schools/checklist-groups';
import { Button, CompletionBar, ErrorNote, Prose, Section, TextLink } from '@/components/system';
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
  const syncStatusQuery = useQuery({ queryKey: ['sync-status'], queryFn: () => clientApi.call('syncStatus'), refetchInterval: POLL_MS });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const application = applicationQuery.data;

  if (applicationQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorNote>
          Could not load this school.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => applicationQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      </div>
    );
  }

  if (!application) return <BackLink />;

  const groups = completionGroups(application.items);
  const totalDone = groups.reduce((sum, group) => sum + group.done, 0);
  const totalAll = groups.reduce((sum, group) => sum + group.total, 0);
  const awaitingCode = syncStatusQuery.data?.awaiting_verification_job_id != null;
  const itemsByGroup = groupChecklistItems(application.items);

  return (
    <div className="flex flex-col gap-8">
      <BackLink />
      <SchoolHeader application={application} timezone={timezone} />

      <div className="flex flex-col gap-2">
        <CompletionBar groups={groups} />
        <p className="text-12 text-fg-2">
          {totalDone} of {totalAll} done
        </p>
        {awaitingCode ? (
          <ErrorNote>
            Common App asked for a verification code. Enter it in <TextLink href="/settings">Settings</TextLink>.
          </ErrorNote>
        ) : null}
      </div>

      <Section title="Requirements">
        <Prose>
          {application.requirements ? (
            requirementsToSentences(application.school.name, application.requirements, timezone).map((sentence, index) => <p key={index}>{sentence}</p>)
          ) : (
            <p>Apogee has not verified this school&rsquo;s requirements yet; the checklist uses the Common App defaults.</p>
          )}
        </Prose>
      </Section>

      {CHECKLIST_GROUP_NAMES.map((name) => {
        const groupItems = itemsByGroup[name];
        if (groupItems.length === 0) return null;
        return (
          <Section key={name} title={name}>
            <ChecklistTable items={groupItems} timezone={timezone} />
          </Section>
        );
      })}

      <AddItemInput applicationId={application.id} />
    </div>
  );
}

function BackLink() {
  return (
    <TextLink href="/schools" className="flex w-fit items-center gap-1 text-12">
      <CaretLeft /> Schools
    </TextLink>
  );
}
