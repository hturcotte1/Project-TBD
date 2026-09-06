'use client';

import type { MessageDto } from '@apogee/shared/api';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { groupMessages, reactionsByTarget, shouldShowTypingIndicator } from '@/components/chat/chat-utils';
import { Composer } from '@/components/chat/composer';
import { MessageThread } from '@/components/chat/message-thread';
import { usePageVisible } from '@/components/chat/use-page-visible';
import { Button, ErrorNote, PageTitle } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { formatUsPhoneAsYouType } from '@/lib/phone';

const POLL_MS = 2000;
const APPROVALS_POLL_MS = 10_000;
const INITIAL_LIMIT = 100;
/** Every 8th poll (~16s while visible) re-fetches the recent window without `after`, so a
 * delivery-status change on an already-seen row (no new message row) still shows up. */
const FULL_RESYNC_EVERY = 8;

export default function ChatPage() {
  const visible = usePageVisible();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => clientApi.call('settingsGet') });
  const approvalsQuery = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => clientApi.call('approvalsList', { query: { status: 'pending' } }),
    refetchInterval: visible ? APPROVALS_POLL_MS : false,
  });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [now, setNow] = useState(() => new Date());
  const cursorRef = useRef<string | undefined>(undefined);
  const pollCountRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threadQuery = useQuery({
    queryKey: ['messages', 'main', 'chat'],
    queryFn: () => {
      const pollIndex = pollCountRef.current;
      pollCountRef.current = pollIndex + 1;
      const doFullResync = cursorRef.current === undefined || pollIndex % FULL_RESYNC_EVERY === 0;
      return clientApi.call('messagesList', {
        params: { kind: 'main' },
        query: doFullResync ? { limit: INITIAL_LIMIT } : { after: cursorRef.current, limit: INITIAL_LIMIT },
      });
    },
    refetchInterval: visible ? POLL_MS : false,
  });

  useEffect(() => {
    const page = threadQuery.data;
    if (!page || page.length === 0) return;
    const lastCreatedAt = page[page.length - 1]?.created_at;
    if (lastCreatedAt) cursorRef.current = lastCreatedAt;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of page) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, [threadQuery.data]);

  useEffect(() => {
    if (!visible) return undefined;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const groups = groupMessages(messages);
  const reactions = reactionsByTarget(messages);
  const showTyping = shouldShowTypingIndicator(messages, now);
  const approvals = approvalsQuery.data ?? [];
  const lastStudentMessage = [...messages].reverse().find((message) => message.kind !== 'reaction' && message.direction === 'inbound');

  const agentPhone = settingsQuery.data?.agent_phone_number;
  const agentName = settingsQuery.data?.agent_name ?? 'Vector';
  const vcardHref = agentPhone ? `/api/vcard?name=${encodeURIComponent(agentName)}&phone=${encodeURIComponent(agentPhone)}` : undefined;
  const loaded = threadQuery.data !== undefined;

  return (
    // Mobile: viewport minus the shell's mobile header (40px), the content column's own vertical
    // padding (24px top + 24px bottom), and the tab bar. Desktop: viewport minus the content
    // column's 32px top + 32px bottom padding (no mobile header, no tab bar) — see DESIGN.md's
    // structure section for those shell measurements.
    <div className="flex h-[calc(100dvh-40px-48px-var(--tabbar))] flex-col lg:h-[calc(100dvh-64px)]">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — Vector has no numeral of its own. A hidden span still warms the font file so
          it's not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle
        meta={agentPhone ? formatUsPhoneAsYouType(agentPhone) : undefined}
        actions={
          vcardHref ? (
            <Button variant="text" asChild>
              <a href={vcardHref}>Save contact</a>
            </Button>
          ) : undefined
        }
      >
        Vector
      </PageTitle>

      <div className="mt-4 flex-1 overflow-y-auto px-0">
        {threadQuery.isError && messages.length === 0 ? (
          <ErrorNote>
            Could not load your messages.{' '}
            <Button variant="text" className="h-auto px-0" onClick={() => threadQuery.refetch()}>
              Try again
            </Button>
          </ErrorNote>
        ) : loaded ? (
          <MessageThread
            groups={groups}
            reactions={reactions}
            lastStudentMessageId={lastStudentMessage?.id}
            timezone={timezone}
            now={now}
            showTyping={showTyping}
            approvals={approvals}
          />
        ) : null}
        <div ref={bottomRef} />
      </div>

      <Composer onSent={() => void threadQuery.refetch()} />
    </div>
  );
}
