'use client';

import type { ApplicationDetailDto } from '@tbd/shared/api';
import type { ApplicationPlan } from '@tbd/shared/domain';
import { APPLICATION_PLANS } from '@tbd/shared/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PLAN_LABELS } from '@/components/schools/plan-labels';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatDate } from '@/lib/format';

const STATUS_LABELS: Record<ApplicationDetailDto['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_to_submit: 'Ready to submit',
  submitted: 'Submitted',
  decision_received: 'Decision received',
};

export function ApplicationHeader({ application, timezone }: { application: ApplicationDetailDto; timezone: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updatePlan = useMutation({
    mutationFn: (plan: ApplicationPlan) => clientApi.call('applicationUpdate', { params: { id: application.id }, body: { plan } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application', application.id] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast({ title: 'Plan updated' });
    },
    onError: () => toast({ title: 'Could not update the plan', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: () => clientApi.call('applicationDelete', { params: { id: application.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast({ title: 'School removed', description: `${application.school.name} is no longer on your list.` });
      router.push('/schools');
    },
    onError: () => toast({ title: 'Could not remove that school', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{application.school.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <DeadlineBadge daysRemaining={application.days_remaining} label={formatDate(application.deadline, timezone)} />
            <Badge variant="outline">{STATUS_LABELS[application.status]}</Badge>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Plan</span>
        <Select value={application.plan} onValueChange={(value) => updatePlan.mutate(value as ApplicationPlan)}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPLICATION_PLANS.map((plan) => (
              <SelectItem key={plan} value={plan}>
                {PLAN_LABELS[plan]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {application.school.name}?</DialogTitle>
            <DialogDescription>This deletes its checklist and stops Remy from tracking it. You can add it back later, but progress won&rsquo;t carry over.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => remove.mutate()} loading={remove.isPending}>
              Remove school
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
