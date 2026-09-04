/**
 * Pure helpers for the dashboard chat mirror: clustering consecutive same-direction messages into
 * visual groups (so the thread reads like iMessage, not a log), mapping tapback reactions onto the
 * message they react to, and deciding when to show the "…" typing indicator.
 */
import type { MessageDto } from '@tbd/shared/api';

export interface MessageGroup {
  direction: MessageDto['direction'];
  messages: MessageDto[];
}

/** A same-direction run more than this far apart starts a new visual group. */
const GROUP_GAP_MS = 5 * 60_000;

/** Reactions render as badges on their target bubble, not as bubbles of their own. */
function isBubbleMessage(message: MessageDto): boolean {
  return message.kind !== 'reaction';
}

/** Clusters consecutive same-direction, non-reaction messages sent within `GROUP_GAP_MS` of each other. */
export function groupMessages(messages: MessageDto[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages.filter(isBubbleMessage)) {
    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup?.messages[lastGroup.messages.length - 1];
    const gapMs = lastMessage ? new Date(message.created_at).getTime() - new Date(lastMessage.created_at).getTime() : Infinity;
    if (lastGroup && lastGroup.direction === message.direction && gapMs <= GROUP_GAP_MS) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ direction: message.direction, messages: [message] });
    }
  }
  return groups;
}

/** Maps each reacted-to message id to the reaction messages that reference it. */
export function reactionsByTarget(messages: MessageDto[]): Map<string, MessageDto[]> {
  const map = new Map<string, MessageDto[]>();
  for (const message of messages) {
    if (message.kind !== 'reaction' || !message.in_reply_to_id) continue;
    const existing = map.get(message.in_reply_to_id);
    if (existing) existing.push(message);
    else map.set(message.in_reply_to_id, [message]);
  }
  return map;
}

const TYPING_WINDOW_MS = 30_000;

/**
 * Shows a typing indicator when the newest real (non-reaction) message is inbound — from the
 * student — and it arrived under 30 seconds ago. Once 30s pass with no outbound reply, the
 * indicator drops rather than sit there forever; the reply, once it lands, becomes the newest
 * message and the check is moot anyway.
 */
export function shouldShowTypingIndicator(messages: MessageDto[], now: Date): boolean {
  const relevant = messages.filter(isBubbleMessage);
  const last = relevant[relevant.length - 1];
  if (!last || last.direction !== 'inbound') return false;
  const elapsedMs = now.getTime() - new Date(last.created_at).getTime();
  return elapsedMs >= 0 && elapsedMs < TYPING_WINDOW_MS;
}
