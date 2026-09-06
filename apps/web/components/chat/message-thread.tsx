'use client';

import type { ApprovalDto, MessageDto } from '@apogee/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment } from 'react';
import { type MessageGroup, threadDividerLabel } from '@/components/chat/chat-utils';
import { Button, Empty, TextLink, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

const TAPBACK_EMOJI: Record<string, string> = {
  love: '❤️',
  heart: '❤️',
  like: '👍',
  thumbs_up: '👍',
  dislike: '👎',
  thumbs_down: '👎',
  laugh: '😂',
  haha: '😂',
  emphasize: '‼️',
  question: '❓',
};

function tapbackEmoji(reaction: string | null): string {
  if (!reaction) return '👍';
  return TAPBACK_EMOJI[reaction.toLowerCase()] ?? reaction;
}

const DELIVERY_LABEL: Record<MessageDto['delivery_status'], string> = {
  queued: 'Sending',
  sent: 'Sending',
  delivered: 'Delivered',
  read: 'Delivered',
  failed: 'Failed',
};

export interface MessageThreadProps {
  groups: MessageGroup[];
  reactions: Map<string, MessageDto[]>;
  /** The most recent message the student sent — only this one ever shows a delivery status. */
  lastStudentMessageId: string | undefined;
  timezone: string;
  now: Date;
  showTyping: boolean;
  approvals: ApprovalDto[];
}

/** The thread body: grouped bubbles with their centered time dividers, the typing indicator, and
 * any pending approvals rendered inline as Vector's own bubbles at the bottom. */
export function MessageThread({ groups, reactions, lastStudentMessageId, timezone, now, showTyping, approvals }: MessageThreadProps) {
  if (groups.length === 0 && approvals.length === 0 && !showTyping) {
    return <Empty sentence="No messages yet. Say hello, or text Vector from your phone." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => {
        const previousGroup = groups[index - 1];
        const previousLast = previousGroup?.messages[previousGroup.messages.length - 1];
        const firstMessage = group.messages[0];
        const divider = firstMessage ? threadDividerLabel(previousLast, firstMessage, timezone, now) : null;
        return (
          <Fragment key={firstMessage?.id ?? index}>
            {divider ? <div className="py-1 text-center text-12 text-fg-3">{divider}</div> : null}
            <MessageBubbleGroup group={group} reactions={reactions} lastStudentMessageId={lastStudentMessageId} />
          </Fragment>
        );
      })}

      {showTyping ? <TypingIndicator /> : null}

      {approvals.length > 0 ? <ApprovalBubbles approvals={approvals} /> : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-lg bg-s2 px-3 py-2.5">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-fg-3" style={{ animationDelay: `${dot * 150}ms` }} />
      ))}
    </div>
  );
}

function ApprovalBubbles({ approvals }: { approvals: ApprovalDto[] }) {
  const queryClient = useQueryClient();
  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => clientApi.call('approvalAnswer', { params: { id }, body: { approve } }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast(variables.approve ? 'Approved.' : 'Rejected.');
    },
    onError: () => toast('Could not record your answer. Try again.'),
  });

  return (
    <div className="flex flex-col items-start gap-1.5">
      {approvals.map((approval) => (
        <div key={approval.id} className="max-w-[75%] rounded-lg bg-s2 px-3 py-2 text-14 text-fg">
          <p className="whitespace-pre-wrap">{approval.summary}</p>
          <div className="mt-2 flex gap-3">
            <Button size="sm" variant="text" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: true })}>
              Approve
            </Button>
            <Button size="sm" variant="quiet" disabled={answer.isPending} onClick={() => answer.mutate({ id: approval.id, approve: false })}>
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageBubbleGroup({
  group,
  reactions,
  lastStudentMessageId,
}: {
  group: MessageGroup;
  reactions: Map<string, MessageDto[]>;
  lastStudentMessageId: string | undefined;
}) {
  const isStudent = group.direction === 'inbound';

  return (
    <div className={cn('flex flex-col gap-0.5', isStudent ? 'items-end' : 'items-start')}>
      {group.messages.map((message, index) => {
        const isFirst = index === 0;
        const targetReactions = reactions.get(message.id) ?? [];
        const media = message.media.filter((item) => item.url);

        return (
          <div key={message.id} className="relative max-w-[75%]">
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-14',
                !isFirst && (isStudent ? 'rounded-tr-none' : 'rounded-tl-none'),
                isStudent ? 'bg-brand text-fg-on-brand' : 'bg-s2 text-fg',
              )}
            >
              {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
              {media.length > 0 ? (
                <div className={cn('flex flex-col gap-1.5', message.body ? 'mt-1.5' : '')}>
                  {media.map((item, mediaIndex) =>
                    item.content_type.startsWith('image/') ? (
                      // A remote iMessage attachment URL, not a build-time asset next/image can optimize.
                      <img key={mediaIndex} src={item.url ?? ''} alt={item.filename ?? 'Attachment'} className="max-w-[240px] rounded" />
                    ) : (
                      <TextLink key={mediaIndex} href={item.url ?? '#'} target="_blank">
                        {item.filename ?? 'Attachment'}
                      </TextLink>
                    ),
                  )}
                </div>
              ) : null}
            </div>

            {targetReactions.length > 0 ? (
              <div className={cn('absolute -top-2 flex gap-0.5', isStudent ? '-left-2' : '-right-2')}>
                {targetReactions.map((reaction) => (
                  <span key={reaction.id} className="flex h-4 items-center rounded-full bg-s3 px-2 text-12 shadow-float" title={reaction.reaction ?? undefined}>
                    {tapbackEmoji(reaction.reaction)}
                  </span>
                ))}
              </div>
            ) : null}

            {message.id === lastStudentMessageId ? (
              <p className={cn('mt-1 text-right text-12', message.delivery_status === 'failed' ? 'text-err' : 'text-fg-3')}>
                {DELIVERY_LABEL[message.delivery_status]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
