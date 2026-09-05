'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { clientApi } from '@/lib/api.client';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const TERMINAL_RUN_OUTCOMES = new Set(['completed', 'failed', 'refused', 'no_action']);

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

export function InterviewChat({ timezone }: { timezone: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', 'interview'],
    queryFn: () => clientApi.call('messagesList', { params: { kind: 'interview' } }),
    refetchInterval: (query) => {
      const messages = query.state.data;
      if (!messages || messages.length === 0) return false;
      const last = messages[messages.length - 1];
      return last && last.direction === 'inbound' ? 2000 : false;
    },
  });

  const messages = messagesQuery.data ?? [];
  const awaitingReply = messages.length > 0 && messages[messages.length - 1]?.direction === 'inbound';

  const send = useMutation({
    mutationFn: (body: string) => clientApi.call('messageSend', { params: { kind: 'interview' }, body: { body } }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['messages', 'interview'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, awaitingReply]);

  return (
    <div className="flex flex-col gap-3">
      <ScrollArea className="h-80 rounded-md border border-border bg-card p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && !messagesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Vector will start with an easy question. Say hi, or just start typing whatever comes to mind.
            </p>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={cn('flex flex-col gap-0.5', message.direction === 'inbound' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                  message.direction === 'inbound' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}
              >
                {message.body}
              </div>
              <span className="px-1 text-[10px] text-muted-foreground">{formatTime(message.created_at, timezone)}</span>
            </div>
          ))}
          {awaitingReply ? <TypingDots /> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) send.mutate(trimmed);
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              const trimmed = draft.trim();
              if (trimmed) send.mutate(trimmed);
            }
          }}
          placeholder="Type your answer…"
          rows={2}
          maxLength={5000}
          className="flex-1"
        />
        <Button type="submit" disabled={!draft.trim()} loading={send.isPending}>
          Send
        </Button>
      </form>
    </div>
  );
}

export { TERMINAL_RUN_OUTCOMES };
