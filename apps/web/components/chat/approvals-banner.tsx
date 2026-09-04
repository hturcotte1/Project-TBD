'use client';

import type { ApprovalDto } from '@tbd/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function ApprovalsBanner({ approvals }: { approvals: ApprovalDto[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => clientApi.call('approvalAnswer', { params: { id }, body: { approve } }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast({ title: variables.approve ? 'Approved' : 'Rejected' });
    },
    onError: () => toast({ title: 'Could not record your answer — try again.', variant: 'destructive' }),
  });

  if (approvals.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-border bg-warn-bg/40 px-4 py-3 sm:px-6">
      {approvals.map((approval) => (
        <div key={approval.id} className="flex flex-col gap-2 rounded-md border border-warn-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> {approval.summary}
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: false })}>
              Reject
            </Button>
            <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: true })}>
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
