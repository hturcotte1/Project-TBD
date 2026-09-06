'use client';

import type { ApplicationDto, RecommenderDto } from '@apogee/shared/api';
import { RECOMMENDER_INVITE_STATUSES, RECOMMENDER_ROLES } from '@apogee/shared/domain';
import type { RecommenderInviteStatus, RecommenderRole } from '@apogee/shared/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/components/system';
import { clientApi } from '@/lib/api.client';

const ROLE_LABELS: Record<RecommenderRole, string> = { teacher: 'Teacher', counselor: 'Counselor', other: 'Other' };
const INVITE_STATUS_LABELS: Record<RecommenderInviteStatus, string> = { not_invited: 'Not invited', invited: 'Invited', submitted: 'Submitted' };

/** Applications still in progress — a submitted or decided application has nothing left for a
 * recommender to be assigned to. */
function isAssignable(application: ApplicationDto): boolean {
  return application.status !== 'submitted' && application.status !== 'decision_received';
}

export interface RecommenderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: ApplicationDto[];
  /** Present for edit; absent for the "Add recommender" flow. */
  recommender?: RecommenderDto;
}

/** The single Drawer behind both "Add recommender" and a row's "Edit": the API only accepts an
 * invite status and invited date on update, so those two fields only render in edit mode. */
export function RecommenderFormDrawer({ open, onOpenChange, applications, recommender }: RecommenderFormDrawerProps) {
  const isEdit = recommender !== undefined;
  const queryClient = useQueryClient();
  const assignable = applications.filter(isAssignable);

  const [name, setName] = useState('');
  const [role, setRole] = useState<RecommenderRole>('teacher');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [inviteStatus, setInviteStatus] = useState<RecommenderInviteStatus>('not_invited');
  const [invitedAt, setInvitedAt] = useState('');

  // Reseeds the form from the target recommender each time the drawer opens, so a prior edit's
  // draft never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setName(recommender?.name ?? '');
    setRole(recommender?.role ?? 'teacher');
    setSubject(recommender?.subject ?? '');
    setEmail(recommender?.email ?? '');
    setApplicationIds(recommender?.assignments.map((a) => a.application_id) ?? []);
    setInviteStatus(recommender?.invite_status ?? 'not_invited');
    setInvitedAt(recommender?.invited_at ?? '');
    // recommender's other fields (assignments, invite status, …) only ever change together with
    // a re-open of this same drawer, so id + open fully capture "the target this form reflects".
  }, [open, recommender]);

  const save = useMutation({
    mutationFn: () => {
      const trimmedEmail = email.trim();
      const trimmedSubject = subject.trim();
      if (recommender) {
        return clientApi.call('recommenderUpdate', {
          params: { id: recommender.id },
          body: {
            name: name.trim(),
            email: trimmedEmail || null,
            subject: trimmedSubject || null,
            application_ids: applicationIds,
            invite_status: inviteStatus,
            invited_at: invitedAt || null,
          },
        });
      }
      return clientApi.call('recommenderCreate', {
        body: { name: name.trim(), role, email: trimmedEmail || null, subject: trimmedSubject || null, application_ids: applicationIds },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommenders'] });
      toast(isEdit ? 'Recommender updated.' : 'Recommender added.');
      onOpenChange(false);
    },
    onError: () => toast('Could not save. Try again.'),
  });

  function toggleApplication(id: string) {
    setApplicationIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle>{isEdit ? `Edit ${recommender.name}` : 'Add a recommender'}</DrawerTitle>
        <DrawerBody>
          <form
            className="flex flex-col gap-4"
            id="recommender-form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Name">
              <Input required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ms. Park" />
            </Field>

            <Select value={role} onValueChange={(value) => setRole(value as RecommenderRole)} disabled={isEdit}>
              <Field label="Role">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </Field>
              <SelectContent>
                {RECOMMENDER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Field label="Subject">
              <Input value={subject} maxLength={80} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. AP Chemistry" />
            </Field>

            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.example" />
            </Field>

            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Schools</span>
              {assignable.length === 0 ? (
                <p className="text-12 text-fg-2">No open applications to assign yet.</p>
              ) : (
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded border border-line-strong p-2">
                  {assignable.map((application) => (
                    <label key={application.id} className="flex h-8 items-center gap-2 rounded px-1.5 text-14 text-fg hover:bg-s2">
                      <Checkbox checked={applicationIds.includes(application.id)} onCheckedChange={() => toggleApplication(application.id)} />
                      {application.school.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {isEdit ? (
              <>
                <Select value={inviteStatus} onValueChange={(value) => setInviteStatus(value as RecommenderInviteStatus)}>
                  <Field label="Invite status">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </Field>
                  <SelectContent>
                    {RECOMMENDER_INVITE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {INVITE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Field label="Invited date">
                  <Input type="date" value={invitedAt} onChange={(event) => setInvitedAt(event.target.value)} />
                </Field>
              </>
            ) : null}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="recommender-form" variant="text" disabled={!name.trim()} loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Add recommender'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
