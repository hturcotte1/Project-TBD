'use client';

import { PaperPlaneRight } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Textarea } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const TERMINAL_RUN_OUTCOMES = new Set(['completed', 'failed', 'refused', 'no_action']);

/** Caps the auto-growing textarea at roughly 5 lines of text-14 (20px line height, 16px vertical
 * padding, 2px border) before it scrolls internally instead of pushing the thread further up.
 * Mirrors `components/chat/composer.tsx`, the other half of this same thread pattern. */
const MAX_TEXTAREA_HEIGHT_PX = 118;

function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-lg bg-s2 px-3 py-2.5">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-fg-3" style={{ animationDelay: `${dot * 150}ms` }} />
      ))}
    </div>
  );
}

/** The intangibles interview as the same Vector thread pattern used in Chat: Vector's bubbles on
 * the left in Surface 2, the student's on the right in brand, a composer with a primary send icon.
 * Also used unchanged from `/profile/interview` — props stay exactly `{ timezone }`. */
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

  function submit() {
    const trimmed = draft.trim();
    if (trimmed) send.mutate(trimmed);
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex h-80 flex-col gap-3 overflow-y-auto rounded bg-s1 p-3">
        {messages.length === 0 && !messagesQuery.isPending ? (
          <p className="py-8 text-center text-14 text-fg-2">Vector will start with an easy question. Say hi, or just start typing whatever comes to mind.</p>
        ) : null}
        {messages.map((message) => {
          const isStudent = message.direction === 'inbound';
          return (
            <div key={message.id} className={cn('flex flex-col gap-0.5', isStudent ? 'items-end' : 'items-start')}>
              <div className={cn('max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-14', isStudent ? 'bg-brand text-fg-on-brand' : 'bg-s2 text-fg')}>
                {message.body}
              </div>
              <span className="px-1 text-12 text-fg-3">{formatTime(message.created_at, timezone)}</span>
            </div>
          );
        })}
        {awaitingReply ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>

      {/* A plain row, not a `<form>`: on the onboarding step this renders inside
          `QuestionLayout`'s own `<form>` (its "I'm done talking" submit), and a nested `<form>`
          is invalid HTML that breaks hydration. Enter-to-send and the button below call `submit()`
          directly instead of relying on a submit event. */}
      <div className="flex items-end gap-2 border-t border-line pt-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          autoResize
          rows={1}
          maxLength={5000}
          placeholder="Type your answer"
          className="flex-1 bg-s2"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT_PX }}
        />
        <Button type="button" variant="primary" iconOnly aria-label="Send" disabled={!draft.trim()} loading={send.isPending} onClick={submit}>
          <PaperPlaneRight />
        </Button>
      </div>
    </div>
  );
}

export { TERMINAL_RUN_OUTCOMES };
