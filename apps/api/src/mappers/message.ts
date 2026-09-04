import type * as S from '@tbd/shared/db/schema';
import type * as D from '@tbd/shared/api';

export function mapMessage(row: S.Message, conversationKind: S.Conversation['kind']): D.MessageDto {
  return {
    id: row.id,
    conversation_kind: conversationKind,
    channel: row.channel,
    direction: row.direction,
    kind: row.kind,
    body: row.body,
    media: row.media,
    reaction: row.reaction,
    in_reply_to_id: row.inReplyToId,
    delivery_status: row.deliveryStatus,
    proactive: row.proactive,
    created_at: row.createdAt.toISOString(),
  };
}
