'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function SyncNowButton() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sync = useMutation({
    mutationFn: () => clientApi.call('syncRun'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast({ title: 'Sync started', description: 'Checking Common App now — this usually takes a minute or two.' });
    },
    onError: () => toast({ title: 'Could not start a sync', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
      <RefreshCw className="h-3.5 w-3.5" /> Sync now
    </Button>
  );
}
