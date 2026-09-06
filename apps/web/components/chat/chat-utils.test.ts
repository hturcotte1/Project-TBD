import type { MessageDto } from '@apogee/shared/api';
import { describe, expect, it } from 'vitest';
import { formatThreadDivider, groupMessages, reactionsByTarget, shouldShowTypingIndicator, threadDividerLabel } from '@/components/chat/chat-utils';

let counter = 0;
function msg(overrides: Partial<MessageDto> & { direction: MessageDto['direction']; created_at: string }): MessageDto {
  counter += 1;
  return {
    id: `msg-${counter}`,
    conversation_kind: 'main',
    channel: 'imessage',
    kind: 'text',
    body: 'hello',
    media: [],
    reaction: null,
    in_reply_to_id: null,
    delivery_status: 'delivered',
    proactive: false,
    ...overrides,
  };
}

describe('groupMessages', () => {
  it('clusters consecutive same-direction messages sent close together', () => {
    const groups = groupMessages([
      msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' }),
      msg({ direction: 'inbound', created_at: '2026-09-02T10:00:30.000Z' }),
      msg({ direction: 'outbound', created_at: '2026-09-02T10:01:00.000Z' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.direction).toBe('inbound');
    expect(groups[0]?.messages).toHaveLength(2);
    expect(groups[1]?.direction).toBe('outbound');
    expect(groups[1]?.messages).toHaveLength(1);
  });

  it('starts a new group after a long gap even in the same direction', () => {
    const groups = groupMessages([
      msg({ direction: 'outbound', created_at: '2026-09-02T09:00:00.000Z' }),
      msg({ direction: 'outbound', created_at: '2026-09-02T09:20:00.000Z' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('excludes reaction messages from bubbles/groups entirely', () => {
    const groups = groupMessages([
      msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' }),
      msg({ direction: 'outbound', kind: 'reaction', reaction: 'heart', in_reply_to_id: 'msg-1', created_at: '2026-09-02T10:00:05.000Z' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages).toHaveLength(1);
  });
});

describe('reactionsByTarget', () => {
  it('maps a reaction to the message it targets', () => {
    const target = msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' });
    const reaction = msg({ direction: 'outbound', kind: 'reaction', reaction: 'heart', in_reply_to_id: target.id, created_at: '2026-09-02T10:00:05.000Z' });
    const map = reactionsByTarget([target, reaction]);
    expect(map.get(target.id)).toEqual([reaction]);
  });

  it('ignores non-reaction messages and reactions without a target', () => {
    const stray = msg({ direction: 'outbound', kind: 'reaction', reaction: 'heart', in_reply_to_id: null, created_at: '2026-09-02T10:00:05.000Z' });
    const text = msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' });
    const map = reactionsByTarget([text, stray]);
    expect(map.size).toBe(0);
  });
});

describe('shouldShowTypingIndicator', () => {
  const now = new Date('2026-09-02T10:00:20.000Z');

  it('shows when the newest message is inbound and under 30s old', () => {
    const messages = [msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' })];
    expect(shouldShowTypingIndicator(messages, now)).toBe(true);
  });

  it('hides once 30s have passed with no reply', () => {
    const messages = [msg({ direction: 'inbound', created_at: '2026-09-02T09:59:00.000Z' })];
    expect(shouldShowTypingIndicator(messages, now)).toBe(false);
  });

  it('hides when the newest message is outbound (already replied)', () => {
    const messages = [
      msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' }),
      msg({ direction: 'outbound', created_at: '2026-09-02T10:00:10.000Z' }),
    ];
    expect(shouldShowTypingIndicator(messages, now)).toBe(false);
  });

  it('ignores a trailing reaction when finding the newest real message', () => {
    const messages = [
      msg({ direction: 'inbound', created_at: '2026-09-02T10:00:00.000Z' }),
      msg({ direction: 'outbound', kind: 'reaction', reaction: 'heart', in_reply_to_id: 'msg-1', created_at: '2026-09-02T10:00:15.000Z' }),
    ];
    expect(shouldShowTypingIndicator(messages, now)).toBe(true);
  });

  it('is false for an empty thread', () => {
    expect(shouldShowTypingIndicator([], now)).toBe(false);
  });
});

const TIMEZONE = 'America/Chicago';

describe('formatThreadDivider', () => {
  const now = new Date('2026-09-05T20:00:00.000Z'); // 2026-09-05 3:00 PM America/Chicago

  it('labels a message from today as "Today <time>"', () => {
    expect(formatThreadDivider('2026-09-05T20:45:00.000Z', TIMEZONE, now)).toBe('Today 3:45 PM');
  });

  it('labels a message from yesterday as "Yesterday <time>"', () => {
    expect(formatThreadDivider('2026-09-04T14:10:00.000Z', TIMEZONE, now)).toBe('Yesterday 9:10 AM');
  });

  it('labels an older message with its date', () => {
    expect(formatThreadDivider('2026-09-03T13:00:00.000Z', TIMEZONE, now)).toBe('Sep 3, 8:00 AM');
  });
});

describe('threadDividerLabel', () => {
  const now = new Date('2026-09-05T20:00:00.000Z');

  it('always shows a divider before the very first group', () => {
    const first = msg({ direction: 'inbound', created_at: '2026-09-05T20:45:00.000Z' });
    expect(threadDividerLabel(undefined, first, TIMEZONE, now)).toBe('Today 3:45 PM');
  });

  it('shows nothing when under 15 minutes separate two groups', () => {
    const previous = msg({ direction: 'inbound', created_at: '2026-09-05T20:00:00.000Z' });
    const next = msg({ direction: 'outbound', created_at: '2026-09-05T20:10:00.000Z' });
    expect(threadDividerLabel(previous, next, TIMEZONE, now)).toBeNull();
  });

  it('shows a divider once 15 minutes or more separate two groups', () => {
    const previous = msg({ direction: 'inbound', created_at: '2026-09-05T20:00:00.000Z' });
    const next = msg({ direction: 'outbound', created_at: '2026-09-05T20:15:00.000Z' });
    expect(threadDividerLabel(previous, next, TIMEZONE, now)).toBe('Today 3:15 PM');
  });
});
