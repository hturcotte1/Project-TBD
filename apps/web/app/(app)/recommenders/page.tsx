'use client';

import type { RecommenderDto } from '@apogee/shared/api';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RecommenderFormDrawer } from '@/components/recommenders/recommender-form-drawer';
import { sortRecommenders } from '@/components/recommenders/recommender-sort';
import { RecommendersTable } from '@/components/recommenders/recommenders-table';
import { ReminderDrawer } from '@/components/recommenders/reminder-drawer';
import { Button, Empty, ErrorNote, PageTitle, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

export default function RecommendersPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const recommendersQuery = useQuery({ queryKey: ['recommenders'], queryFn: () => clientApi.call('recommendersList') });
  const applicationsQuery = useQuery({ queryKey: ['applications'], queryFn: () => clientApi.call('applicationsList') });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';
  const applications = applicationsQuery.data ?? [];
  const applicationsById = new Map(applications.map((application) => [application.id, application]));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecommenderDto | undefined>(undefined);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderRecommender, setReminderRecommender] = useState<RecommenderDto | null>(null);
  const [reminderRunId, setReminderRunId] = useState<string | null>(null);

  const requestDraft = useMutation({
    mutationFn: (recommender: RecommenderDto) => clientApi.call('recommenderReminderDraft', { params: { id: recommender.id } }),
    onSuccess: (result, recommender) => {
      setReminderRecommender(recommender);
      setReminderRunId(result.run_id);
      setReminderOpen(true);
    },
    onError: () => toast('Could not start a draft. Try again.'),
  });

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(recommender: RecommenderDto) {
    setEditing(recommender);
    setFormOpen(true);
  }

  const recommenders = sortRecommenders(recommendersQuery.data ?? [], applicationsById);

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — this page's DaysFigure numerals stay in the interface face. A hidden span still
          warms the font file so it's not left completely unloaded (same warm-up Schools, Essays
          and Timeline do for their own pages). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle
        actions={
          <Button variant="primary" onClick={openAdd}>
            Add recommender
          </Button>
        }
      >
        Recommenders
      </PageTitle>

      {recommendersQuery.isError ? (
        <ErrorNote>
          Could not load your recommenders.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => recommendersQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : recommendersQuery.data && recommenders.length === 0 ? (
        <Empty sentence="No recommenders yet. Common App adds them after a sync, or add one now." action={{ label: 'Add recommender', onClick: openAdd }} />
      ) : recommendersQuery.data ? (
        <RecommendersTable
          recommenders={recommenders}
          applicationsById={applicationsById}
          timezone={timezone}
          onEdit={openEdit}
          onDraftReminder={(recommender) => requestDraft.mutate(recommender)}
        />
      ) : null}

      <RecommenderFormDrawer open={formOpen} onOpenChange={setFormOpen} applications={applications} recommender={editing} />

      <ReminderDrawer open={reminderOpen} onOpenChange={setReminderOpen} recommenderName={reminderRecommender?.name ?? ''} runId={reminderRunId} />
    </div>
  );
}
