'use client';

import type { MessageDto } from '@tbd/shared/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApprovalsBanner } from '@/components/chat/approvals-banner';
import { groupMessages, reactionsByTarget, shouldShowTypingIndicator } from '@/components/chat/chat-utils';
import { Composer } from '@/components/chat/composer';
import { MessageBubbleGroup } from '@/components/chat/message-bubble';
import { usePageVisible } from '@/components/chat/use-page-visible';
import { PageHeader } from '@/components/layout/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

const POLL_MS = 2000;
const APPROVALS_POLL_MS = 10_000;
const INITIAL_LIMIT = 100;
/** Every 8th poll (~16s while visible) re-fetches the recent window without `after`, so a
 * delivery-status change on an already-seen row (no new message row) still shows up. */
const FULL_RESYNC_EVERY = 8;

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-muted px-3.5 py-2.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

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
  const agentName = settingsQuery.data?.agent_name ?? 'your agent';

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
  const pendingApprovals = approvalsQuery.data ?? [];

  return (
    <div className="pb-4">
      <PageHeader title="Chat" description="The dashboard mirror of your iMessage thread." />
      <ApprovalsBanner approvals={pendingApprovals} />

      <div className="px-4 py-4 sm:px-6">
        <ScrollArea className="h-[65vh] min-h-[420px] rounded-md border border-border bg-card p-3">
          <div className="flex flex-col gap-3">
            {threadQuery.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="ml-auto h-12 w-1/2" />
                <Skeleton className="h-12 w-3/5" />
              </div>
            ) : threadQuery.isError && messages.length === 0 ? (
              <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load your messages — try refreshing.</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Say hi below, or text {agentName} directly — either way, it shows up here.
              </p>
            ) : (
              groups.map((group, index) => (
                <MessageBubbleGroup key={group.messages[0]?.id ?? index} group={group} reactionsByTarget={reactions} timezone={timezone} />
              ))
            )}
            {showTyping ? <TypingDots /> : null}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <Composer agentName={agentName} onSent={() => void threadQuery.refetch()} />
    </div>
  );
}
