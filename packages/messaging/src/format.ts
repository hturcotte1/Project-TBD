import type { Tapback } from '@tbd/shared/adapters';

/**
 * Strips common markdown syntax down to plain text suitable for an iMessage bubble: headers lose
 * their `#`, bullets become `• `, bold/italic markers are removed, code fences keep their content
 * but lose the backticks, and `[text](url)` links become `text (url)`. Blank-line runs collapse to
 * a single paragraph break.
 */
export function formatForIMessage(text: string): string {
  let out = text.replace(/\r\n/g, '\n');

  // Fenced code blocks: drop the fence markers, keep the code as plain text.
  out = out.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_m, code: string) => code.trim());
  // Inline code.
  out = out.replace(/`([^`]+)`/g, '$1');

  // Headers.
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.*)$/gm, '$1');

  // Bullet list markers -> a plain bullet glyph. Done before emphasis stripping so a leading
  // `*` or `-` list marker isn't mistaken for italics/bold.
  out = out.replace(/^[ \t]*[-*+][ \t]+/gm, '• ');

  // Bold / italic emphasis.
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/__([^_]+)__/g, '$1');
  out = out.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '$1');
  out = out.replace(/(?<![_\w])_([^_\n]+)_(?!_)/g, '$1');

  // [text](url) -> text (url); <https://...> -> https://...
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)');
  out = out.replace(/<(https?:\/\/[^>\s]+)>/g, '$1');

  // Trim trailing whitespace per line, then collapse 3+ newlines to a single blank line.
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return (matches ?? [text]).map((s) => s.trim()).filter((s) => s.length > 0);
}

function splitByWords(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxLen) {
      current += ` ${word}`;
    } else {
      out.push(current);
      current = word;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * Splits text into a sequence of message-sized chunks, each at most `maxLen` characters.
 * Prefers to break on paragraph boundaries, then sentence boundaries, then word boundaries.
 * Never splits in the middle of a word (a single word longer than `maxLen` is kept whole).
 */
export function splitIntoTexts(text: string, maxLen = 1000): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
  };

  const addUnit = (unit: string, sep: string) => {
    if (current.length === 0) {
      current = unit;
    } else if (current.length + sep.length + unit.length <= maxLen) {
      current += sep + unit;
    } else {
      flush();
      current = unit;
    }
  };

  const paragraphs = trimmed.split(/\n{2,}/);
  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.trim();
    if (paragraph.length === 0) continue;
    if (paragraph.length <= maxLen) {
      addUnit(paragraph, '\n\n');
      continue;
    }
    for (const sentence of splitSentences(paragraph)) {
      if (sentence.length <= maxLen) {
        addUnit(sentence, ' ');
        continue;
      }
      for (const wordChunk of splitByWords(sentence, maxLen)) {
        addUnit(wordChunk, ' ');
      }
    }
  }
  flush();
  return chunks;
}

/**
 * Normalizes a phone number to E.164. Assumes US/NANP numbers when no country code is present:
 * a bare 10-digit number becomes `+1XXXXXXXXXX`. Returns null when the input cannot be normalized.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) {
    if (!/^[2-9]/.test(digits)) return null;
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const rest = digits.slice(1);
    if (!/^[2-9]/.test(rest)) return null;
    return `+${digits}`;
  }
  return null;
}

export interface VCardInput {
  firstName: string;
  lastName?: string;
  phone: string;
  url?: string;
  note?: string;
  org?: string;
}

function escapeVCardValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** Builds a valid vCard 3.0 contact card with CRLF line endings, as required by the spec. */
export function buildVCard(input: VCardInput): string {
  const last = input.lastName ?? '';
  const fullName = [input.firstName, last].filter((p) => p.length > 0).join(' ');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCardValue(last)};${escapeVCardValue(input.firstName)};;;`,
    `FN:${escapeVCardValue(fullName)}`,
  ];
  if (input.org) lines.push(`ORG:${escapeVCardValue(input.org)}`);
  lines.push(`TEL;TYPE=CELL:${input.phone}`);
  if (input.url) lines.push(`URL:${escapeVCardValue(input.url)}`);
  if (input.note) lines.push(`NOTE:${escapeVCardValue(input.note)}`);
  lines.push('END:VCARD');
  return `${lines.join('\r\n')}\r\n`;
}

const TAPBACK_EMOJI: Record<Tapback, string> = {
  love: '❤️',
  like: '👍',
  dislike: '👎',
  laugh: '😂',
  emphasize: '‼️',
  question: '❓',
};

/** Canonical emoji rendering for a classic iMessage tapback. */
export function tapbackToEmoji(t: Tapback): string {
  return TAPBACK_EMOJI[t];
}

const EMOJI_TO_TAPBACK: Record<string, Tapback> = {
  '❤️': 'love',
  '❤': 'love',
  '♥️': 'love',
  '👍': 'like',
  '👍🏻': 'like',
  '👍🏼': 'like',
  '👍🏽': 'like',
  '👍🏾': 'like',
  '👍🏿': 'like',
  '👎': 'dislike',
  '👎🏻': 'dislike',
  '👎🏼': 'dislike',
  '👎🏽': 'dislike',
  '👎🏾': 'dislike',
  '👎🏿': 'dislike',
  '😂': 'laugh',
  '🤣': 'laugh',
  '‼️': 'emphasize',
  '‼': 'emphasize',
  '❓': 'question',
  '❔': 'question',
};

/** Inverse of `tapbackToEmoji`, accepting a few common skin-tone/rendering variants. Null if unrecognized. */
export function emojiToTapback(s: string): Tapback | null {
  return EMOJI_TO_TAPBACK[s.trim()] ?? null;
}
