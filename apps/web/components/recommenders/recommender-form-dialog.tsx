'use client';

import type { ApplicationDto, RecommenderDto } from '@apogee/shared/api';
import { RECOMMENDER_INVITE_STATUSES, RECOMMENDER_ROLES } from '@apogee/shared/domain';
import type { RecommenderInviteStatus, RecommenderRole } from '@apogee/shared/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const ROLE_LABELS: Record<RecommenderRole, string> = { teacher: 'Teacher', counselor: 'Counselor', other: 'Other' };
const INVITE_STATUS_LABELS: Record<RecommenderInviteStatus, string> = { not_invited: 'Not invited', invited: 'Invited', submitted: 'Submitted' };

export interface RecommenderFormDialogProps {
  applications: ApplicationDto[];
  /** Present for edit; absent for the "Add recommender" flow. */
  recommender?: RecommenderDto;
}

export function RecommenderFormDialog({ applications, recommender }: RecommenderFormDialogProps) {
  const isEdit = recommender !== undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recommender?.name ?? '');
  const [role, setRole] = useState<RecommenderRole>(recommender?.role ?? 'teacher');
  const [subject, setSubject] = useState(recommender?.subject ?? '');
  const [email, setEmail] = useState(recommender?.email ?? '');
  const [applicationIds, setApplicationIds] = useState<string[]>(recommender?.assignments.map((a) => a.application_id) ?? []);
  const [inviteStatus, setInviteStatus] = useState<RecommenderInviteStatus>(recommender?.invite_status ?? 'not_invited');
  const [invitedAt, setInvitedAt] = useState(recommender?.invited_at ?? '');

  function resetToRecommender() {
    setName(recommender?.name ?? '');
    setRole(recommender?.role ?? 'teacher');
    setSubject(recommender?.subject ?? '');
    setEmail(recommender?.email ?? '');
    setApplicationIds(recommender?.assignments.map((a) => a.application_id) ?? []);
    setInviteStatus(recommender?.invite_status ?? 'not_invited');
    setInvitedAt(recommender?.invited_at ?? '');
  }

  const save = useMutation({
    mutationFn: () => {
      const trimmedEmail = email.trim();
      const trimmedSubject = subject.trim();
      if (isEdit) {
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
      toast({ title: isEdit ? 'Recommender updated' : 'Recommender added' });
      setOpen(false);
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  function toggleApplication(id: string) {
    setApplicationIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToRecommender();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button type="button" variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ) : (
          <Button type="button">
            <Plus className="h-3.5 w-3.5" /> Add recommender
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit recommender' : 'Add a recommender'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-name">Name</Label>
              <Input id="rec-name" required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ms. Park" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as RecommenderRole)} disabled={isEdit}>
                <SelectTrigger id="rec-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECOMMENDER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-subject">Subject (optional)</Label>
              <Input id="rec-subject" value={subject} maxLength={80} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. AP English Language" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-email">Email (optional)</Label>
              <Input id="rec-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.example" />
            </div>
          </div>

          {isEdit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rec-invite-status">Invite status</Label>
                <Select value={inviteStatus} onValueChange={(value) => setInviteStatus(value as RecommenderInviteStatus)}>
                  <SelectTrigger id="rec-invite-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECOMMENDER_INVITE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {INVITE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-invited-at">Invited on</Label>
                <Input id="rec-invited-at" type="date" value={invitedAt} onChange={(event) => setInvitedAt(event.target.value)} />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Schools this person recommends you for</Label>
            {applications.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a school to your list first, then come back to assign recommenders.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {applications.map((application) => (
                  <label key={application.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                    <Checkbox checked={applicationIds.includes(application.id)} onCheckedChange={() => toggleApplication(application.id)} />
                    {application.school.name}
                    <span className="text-xs text-muted-foreground">{application.plan}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()} loading={save.isPending}>
              {isEdit ? 'Save changes' : 'Add recommender'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
