'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalDto } from '@apogee/shared/api';
import type { ApprovalKind } from '@apogee/shared/domain';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerTitle, DrawerTrigger, Section, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  fill_fields: 'Fill in fields',
  submit: 'Submit the application',
  custom: 'Custom action',
};

export interface WaitingOnYouProps {
  approvals: ApprovalDto[];
}

/** "Waiting on you": only rendered by the caller when there's at least one pending approval. */
export function WaitingOnYou({ approvals }: WaitingOnYouProps) {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => clientApi.call('approvalAnswer', { params: { id }, body: { approve } }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast(variables.approve ? 'Approved. Vector will do this now.' : 'Rejected. Vector will leave this alone.');
      setOpenId(null);
    },
    onError: () => toast('Could not record your answer. Try again.'),
  });

  return (
    <Section title="Waiting on you">
      <div className="flex flex-col gap-4 lg:gap-1">
        {approvals.map((approval) => (
          <div key={approval.id} className="flex flex-col gap-2 lg:h-row lg:flex-row lg:items-center lg:justify-between">
            <p className="text-14 text-fg">{approval.summary}</p>
            <div className="flex shrink-0 items-center gap-3">
              <Drawer open={openId === approval.id} onOpenChange={(next) => setOpenId(next ? approval.id : null)}>
                <DrawerTrigger asChild>
                  <Button variant="text" size="sm">
                    Review
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerTitle>{approval.summary}</DrawerTitle>
                  <DrawerBody>
                    <div className="flex flex-col gap-4">
                      <p className="text-14 text-fg-2">{APPROVAL_KIND_LABELS[approval.kind]}</p>
                      {approval.payload.kind === 'fill_fields' ? (
                        <dl className="flex flex-col gap-3">
                          {approval.payload.fields.map((field) => (
                            <div key={field.path} className="flex flex-col gap-1">
                              <dt className="text-12 text-fg-2">{field.label}</dt>
                              <dd className="text-14 text-fg">{String(field.value)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <p className="text-12 text-fg-3">{`Expires ${relativeTimeFromNow(approval.expires_at)}`}</p>
                    </div>
                  </DrawerBody>
                  <DrawerFooter>
                    <Button variant="quiet" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: false })}>
                      Reject
                    </Button>
                    <Button variant="primary" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: true })}>
                      Approve
                    </Button>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
              <Button
                variant="text"
                size="sm"
                className="hidden lg:inline-flex"
                disabled={answer.isPending}
                onClick={() => answer.mutate({ id: approval.id, approve: true })}
              >
                Approve
              </Button>
              <Button
                variant="quiet"
                size="sm"
                className="hidden lg:inline-flex"
                disabled={answer.isPending}
                onClick={() => answer.mutate({ id: approval.id, approve: false })}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
