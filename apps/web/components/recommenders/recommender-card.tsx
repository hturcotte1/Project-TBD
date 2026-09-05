'use client';

import type { AgentRunDto, ApplicationDto, RecommenderDto } from '@apogee/shared/api';
import type { RecommenderRole } from '@apogee/shared/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, MessageSquareText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { RecommenderFormDialog } from '@/components/recommenders/recommender-form-dialog';
import { derivePerSchoolStatus } from '@/components/recommenders/recommender-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatDateWithYear, relativeTimeFromNow } from '@/lib/format';

const ROLE_LABELS: Record<RecommenderRole, string> = { teacher: 'Teacher', counselor: 'Counselor', other: 'Other' };
const INVITE_STATUS_LABELS = { not_invited: 'Not invited', invited: 'Invited', submitted: 'Submitted' } as const;
const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);

function draftTextFrom(run: AgentRunDto | undefined): string {
  const value = run?.metadata.draft_text;
  return typeof value === 'string' ? value : '';
}

export function RecommenderCard({ recommender, applications, timezone }: { recommender: RecommenderDto; applications: ApplicationDto[]; timezone: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftRunId, setDraftRunId] = useState<string | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);

  const draftRunQuery = useQuery({
    queryKey: ['agent-run', draftRunId],
    queryFn: () => clientApi.call('agentRunGet', { params: { id: draftRunId as string } }),
    enabled: draftRunId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_RUN_OUTCOMES.has(query.state.data.outcome) ? false : 1500),
  });

  const requestDraft = useMutation({
    mutationFn: () => clientApi.call('recommenderReminderDraft', { params: { id: recommender.id } }),
    onSuccess: (result) => {
      setDraftRunId(result.run_id);
      setDraftDialogOpen(true);
    },
    onError: () => toast({ title: 'Could not start a draft — try again.', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: () => clientApi.call('recommenderDelete', { params: { id: recommender.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommenders'] });
      toast({ title: 'Recommender removed' });
    },
    onError: () => toast({ title: 'Could not remove — try again.', variant: 'destructive' }),
    onSettled: () => setConfirmDelete(false),
  });

  const drafting = requestDraft.isPending || (draftRunId !== null && draftDialogOpen && !TERMINAL_RUN_OUTCOMES.has(draftRunQuery.data?.outcome ?? 'pending'));
  const draftText = draftTextFrom(draftRunQuery.data);
  const draftFailed = draftRunQuery.data && draftRunQuery.data.outcome !== 'completed' && TERMINAL_RUN_OUTCOMES.has(draftRunQuery.data.outcome);

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftText);
      toast({ title: 'Copied' });
    } catch {
      toast({ title: 'Could not copy — select and copy the text manually.', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{recommender.name}</p>
            <Badge variant="outline">{ROLE_LABELS[recommender.role]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{recommender.subject ?? 'No subject noted'}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {recommender.email ? (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {recommender.email}
              </span>
            ) : (
              <span>No email on file</span>
            )}
            <span>Invite: {INVITE_STATUS_LABELS[recommender.invite_status]}</span>
            {recommender.invited_at ? <span>Invited {formatDateWithYear(recommender.invited_at, timezone)}</span> : null}
            {recommender.last_nudged_at ? <span>Last nudged {relativeTimeFromNow(recommender.last_nudged_at)}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <RecommenderFormDialog recommender={recommender} applications={applications} />
          <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {recommender.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not assigned to any school yet — edit this recommender to pick which applications they cover.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">School</th>
                  <th className="px-3 py-2 font-medium">Deadline</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {recommender.assignments.map((assignment) => {
                  const derived = derivePerSchoolStatus(assignment);
                  const application = applications.find((a) => a.id === assignment.application_id);
                  return (
                    <tr key={assignment.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{assignment.school_name}</td>
                      <td className="px-3 py-2">
                        <DeadlineBadge daysRemaining={application?.days_remaining ?? null} label={formatDateWithYear(assignment.deadline, timezone)} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={derived.badgeVariant}>{derived.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{derived.lastSeenText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" disabled={requestDraft.isPending} onClick={() => requestDraft.mutate()}>
          {requestDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="h-3.5 w-3.5" />}
          Draft a polite reminder for me to send
        </Button>
      </CardContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {recommender.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes them from every school they&rsquo;re assigned to on this dashboard. It doesn&rsquo;t contact them or change anything on Common App.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" loading={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reminder draft for {recommender.name}</DialogTitle>
          </DialogHeader>
          {drafting ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
            </p>
          ) : draftFailed ? (
            <p className="text-sm text-destructive">Couldn&rsquo;t put together a draft this time — try again in a moment.</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">{draftText}</p>
              <p className="text-xs text-muted-foreground">You send this — the agent never emails anyone.</p>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraftDialogOpen(false)}>
              Close
            </Button>
            {!drafting && !draftFailed ? (
              <Button type="button" onClick={() => void copyDraft()}>
                Copy
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
