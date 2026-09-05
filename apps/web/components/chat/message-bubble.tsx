import type { MessageDto } from '@apogee/shared/api';
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageGroup } from '@/components/chat/chat-utils';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const DELIVERY_ICON: Record<MessageDto['delivery_status'], ComponentType<{ className?: string }> | null> = {
  queued: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

function DeliveryTick({ status }: { status: MessageDto['delivery_status'] }) {
  const Icon = DELIVERY_ICON[status];
  if (!Icon) return null;
  return <Icon className={cn('h-3 w-3', status === 'failed' ? 'text-destructive' : status === 'read' ? 'text-primary' : 'text-muted-foreground')} />;
}

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

export function MessageBubbleGroup({
  group,
  reactionsByTarget,
  timezone,
}: {
  group: MessageGroup;
  reactionsByTarget: Map<string, MessageDto[]>;
  timezone: string;
}) {
  const isInbound = group.direction === 'inbound';

  return (
    <div className={cn('flex flex-col gap-1', isInbound ? 'items-end' : 'items-start')}>
      {group.messages.map((message, index) => {
        const isLast = index === group.messages.length - 1;
        const reactions = reactionsByTarget.get(message.id) ?? [];
        const images = message.media.filter((m) => m.url);

        return (
          <div key={message.id} className="relative max-w-[80%]">
            <div
              className={cn(
                'whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                isInbound ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                !isInbound && message.proactive ? 'border border-dashed border-border' : '',
              )}
            >
              {message.body ? <p>{message.body}</p> : null}
              {images.length > 0 ? (
                <div className={cn('flex flex-wrap gap-1.5', message.body ? 'mt-1.5' : '')}>
                  {images.map((media, mediaIndex) => (
                    <img key={mediaIndex} src={media.url ?? ''} alt={media.filename ?? 'attachment'} className="h-32 w-32 rounded-lg object-cover" />
                  ))}
                </div>
              ) : null}
            </div>

            {reactions.length > 0 ? (
              <div className={cn('absolute -bottom-2 flex gap-0.5', isInbound ? '-left-1' : '-right-1')}>
                {reactions.map((reactionMessage) => (
                  <span
                    key={reactionMessage.id}
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-[9px] leading-none"
                    title={reactionMessage.reaction ?? undefined}
                  >
                    {tapbackEmoji(reactionMessage.reaction)}
                  </span>
                ))}
              </div>
            ) : null}

            {isLast ? (
              <div className={cn('mt-1.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground', isInbound ? 'justify-end' : 'justify-start')}>
                {!isInbound && message.proactive ? <span className="italic">proactive ·</span> : null}
                <span>{formatTime(message.created_at, timezone)}</span>
                {!isInbound ? <DeliveryTick status={message.delivery_status} /> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
