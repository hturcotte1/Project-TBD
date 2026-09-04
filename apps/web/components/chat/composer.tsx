'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function Composer({ agentName, onSent }: { agentName: string; onSent: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState('');

  const send = useMutation({
    mutationFn: (body: string) => clientApi.call('messageSend', { params: { kind: 'main' }, body: { body } }),
    onSuccess: () => {
      setDraft('');
      onSent();
    },
    onError: () => toast({ title: 'Could not send — try again.', variant: 'destructive' }),
  });

  function submit() {
    const trimmed = draft.trim();
    if (trimmed) send.mutate(trimmed);
  }

  return (
    <div className="space-y-1.5 border-t border-border bg-card px-4 py-3 sm:px-6">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Text your agent…"
          rows={1}
          maxLength={5000}
          className="min-h-10 flex-1 resize-none"
        />
        <Button type="submit" disabled={!draft.trim()} loading={send.isPending}>
          Send
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Same thread as your texts with {agentName}.</p>
    </div>
  );
}
