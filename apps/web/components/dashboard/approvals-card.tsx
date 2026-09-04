'use client';

import type { ApprovalDto } from '@tbd/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function ApprovalsCard({ approvals }: { approvals: ApprovalDto[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => clientApi.call('approvalAnswer', { params: { id }, body: { approve } }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast({
        title: variables.approve ? 'Approved' : 'Rejected',
        description: variables.approve ? 'Remy will act on this now.' : 'Remy will leave this alone.',
      });
    },
    onError: () => {
      toast({ title: 'Something went wrong', description: 'Could not record your answer — try again.', variant: 'destructive' });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{approvals.length === 0 ? 'Waiting on you' : `Waiting on you (${approvals.length})`}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {approvals.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to approve"
            description="When Remy drafts something that needs your yes — filling in activities, answering a college's questions — it shows up here first."
          />
        ) : (
          <div className="space-y-3">
            {approvals.map((approval) => (
              <div key={approval.id} className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">{approval.summary}</p>
                <div className="flex shrink-0 gap-2">
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
        )}
      </CardContent>
    </Card>
  );
}
