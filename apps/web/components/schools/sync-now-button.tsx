'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, type ButtonVariant, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { isSyncActive } from '@/components/schools/sync-state';

const SYNC_STATUS_POLL_MS = 20_000;

export function SyncNowButton({ variant = 'text', className }: { variant?: Extract<ButtonVariant, 'text' | 'quiet'>; className?: string }) {
  const queryClient = useQueryClient();
  const syncStatusQuery = useQuery({ queryKey: ['sync-status'], queryFn: () => clientApi.call('syncStatus'), refetchInterval: SYNC_STATUS_POLL_MS });
  const active = isSyncActive(syncStatusQuery.data?.last_job?.status);

  const sync = useMutation({
    mutationFn: () => clientApi.call('syncRun'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['application'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast('Sync started.');
    },
    onError: () => toast('Could not start a sync. Try again in a moment.'),
  });

  return (
    <Button
      variant={variant}
      className={className}
      loading={sync.isPending}
      onClick={() => {
        if (active) {
          toast('A sync is already running.');
          return;
        }
        sync.mutate();
      }}
    >
      Sync now
    </Button>
  );
}
