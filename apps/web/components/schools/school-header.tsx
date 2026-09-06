'use client';

import type { ApplicationDetailDto } from '@apogee/shared/api';
import type { ApplicationPlan } from '@apogee/shared/domain';
import { APPLICATION_PLANS } from '@apogee/shared/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  Countdown,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  toast,
} from '@/components/system';
import { formatDeadlineDate } from '@/components/schools/format-deadline';
import { NotesDrawer } from '@/components/schools/notes-drawer';
import { PLAN_LABELS } from '@/components/schools/plan-labels';
import { isSubmittedApplication } from '@/components/schools/sort';
import { SyncNowButton } from '@/components/schools/sync-now-button';
import { clientApi } from '@/lib/api.client';

export function SchoolHeader({ application, timezone }: { application: ApplicationDetailDto; timezone: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['application', application.id] });
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
  }

  const updatePlan = useMutation({
    mutationFn: (plan: ApplicationPlan) => clientApi.call('applicationUpdate', { params: { id: application.id }, body: { plan } }),
    onSuccess: invalidate,
    onError: () => toast('Could not update the plan. Try again in a moment.'),
  });

  const saveNotes = useMutation({
    mutationFn: (notes: string) => clientApi.call('applicationUpdate', { params: { id: application.id }, body: { notes } }),
    onSuccess: () => {
      invalidate();
      setNoteOpen(false);
      toast('Note saved.');
    },
    onError: () => toast('Could not save that note. Try again in a moment.'),
  });

  const markSubmitted = useMutation({
    mutationFn: () => clientApi.call('applicationUpdate', { params: { id: application.id }, body: { status: 'submitted' } }),
    onSuccess: () => {
      invalidate();
      setSubmitConfirmOpen(false);
      toast('Marked as submitted.');
    },
    onError: () => toast('Could not update this school. Try again in a moment.'),
  });

  const removeSchool = useMutation({
    mutationFn: () => clientApi.call('applicationDelete', { params: { id: application.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast(`${application.school.name} is no longer on your list.`);
      router.push('/schools');
    },
    onError: () => toast('Could not remove this school. Try again in a moment.'),
  });

  const pastDue = application.days_remaining < 0;
  const label = `days ${pastDue ? 'past' : 'until'} ${PLAN_LABELS[application.plan]}, ${formatDeadlineDate(application.deadline, timezone)}.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-34 font-semibold">{application.school.name}</h1>
          <p className="text-14 text-fg-2">
            {application.school.city}, {application.school.state}
          </p>
        </div>
        <Countdown days={application.days_remaining} size="header" label={label} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SyncNowButton className="h-auto px-0" />
        {application.common_app_url ? (
          <Button variant="text" className="h-auto px-0" asChild>
            <a href={application.common_app_url} target="_blank" rel="noreferrer noopener">
              Open in Common App
            </a>
          </Button>
        ) : null}
        <Menu>
          <MenuTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Change plan
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            {APPLICATION_PLANS.map((plan) => (
              <MenuItem key={plan} onSelect={() => updatePlan.mutate(plan)}>
                {PLAN_LABELS[plan]}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              More
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => setNoteOpen(true)}>Add a note</MenuItem>
            {!isSubmittedApplication(application) ? <MenuItem onSelect={() => setSubmitConfirmOpen(true)}>Mark as submitted</MenuItem> : null}
            <MenuItem danger onSelect={() => setRemoveConfirmOpen(true)}>
              Remove school
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <NotesDrawer
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title={`Notes for ${application.school.name}`}
        notes={application.notes}
        saving={saveNotes.isPending}
        onSave={(notes) => saveNotes.mutate(notes)}
      />

      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent>
          <DialogTitle>Mark {application.school.name} as submitted?</DialogTitle>
          <DialogDescription>Apogee never submits for you; this only records that you did.</DialogDescription>
          <DialogActions>
            <Button variant="quiet" onClick={() => setSubmitConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={markSubmitted.isPending} onClick={() => markSubmitted.mutate()}>
              Mark as submitted
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent>
          <DialogTitle>Remove {application.school.name}?</DialogTitle>
          <DialogDescription>This deletes its checklist and stops Vector from tracking it. You can add it back later, but progress won&rsquo;t carry over.</DialogDescription>
          <DialogActions>
            <Button variant="quiet" onClick={() => setRemoveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={removeSchool.isPending} onClick={() => removeSchool.mutate()}>
              Remove school
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </div>
  );
}
