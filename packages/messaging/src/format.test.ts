import { describe, expect, it } from 'vitest';
import {
  buildVCard,
  emojiToTapback,
  formatForIMessage,
  normalizePhone,
  splitIntoTexts,
  tapbackToEmoji,
} from './format';

describe('formatForIMessage', () => {
  it('strips headers', () => {
    expect(formatForIMessage('# Big Title\n## Subtitle\ntext')).toBe('Big Title\nSubtitle\ntext');
  });

  it('strips bold and italic markers', () => {
    expect(formatForIMessage('this is **bold** and this is *italic* and __also bold__')).toBe(
      'this is bold and this is italic and also bold',
    );
  });

  it('converts bullet lists to a plain bullet glyph', () => {
    expect(formatForIMessage('- first\n- second\n* third')).toBe('• first\n• second\n• third');
  });

  it('strips code fences but keeps the code text', () => {
    expect(formatForIMessage('before\n```js\nconst x = 1;\n```\nafter')).toBe('before\nconst x = 1;\nafter');
  });

  it('strips inline code backticks', () => {
    expect(formatForIMessage('run `npm test` now')).toBe('run npm test now');
  });

  it('converts markdown links to "text (url)"', () => {
    expect(formatForIMessage('see [the portal](https://example.com/portal) for details')).toBe(
      'see the portal (https://example.com/portal) for details',
    );
  });

  it('collapses runs of blank lines to a single paragraph break', () => {
    expect(formatForIMessage('one\n\n\n\n\ntwo')).toBe('one\n\ntwo');
  });

  it('trims leading and trailing whitespace', () => {
    expect(formatForIMessage('   \n  hello  \n  ')).toBe('hello');
  });

  it('does not mangle a lone asterisk used as punctuation', () => {
    expect(formatForIMessage('call it a night *')).toBe('call it a night *');
  });
});

describe('splitIntoTexts', () => {
  it('returns the whole text as one chunk when under the limit', () => {
    expect(splitIntoTexts('short message', 1000)).toEqual(['short message']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitIntoTexts('   ', 1000)).toEqual([]);
  });

  it('splits on paragraph boundaries first', () => {
    const a = 'A'.repeat(60);
    const b = 'B'.repeat(60);
    const chunks = splitIntoTexts(`${a}\n\n${b}`, 100);
    expect(chunks).toEqual([a, b]);
  });

  it('packs multiple short paragraphs into one chunk when they fit', () => {
    const chunks = splitIntoTexts('one.\n\ntwo.\n\nthree.', 100);
    expect(chunks).toEqual(['one.\n\ntwo.\n\nthree.']);
  });

  it('falls back to sentence boundaries within an over-long paragraph', () => {
    const sentence1 = 'This is the first sentence of the paragraph, written to be fairly long.';
    const sentence2 = 'This is the second sentence, also written to be fairly long indeed.';
    const paragraph = `${sentence1} ${sentence2}`;
    const chunks = splitIntoTexts(paragraph, sentence1.length + 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(paragraph.replace(/\s+/g, ' '));
  });

  it('never splits in the middle of a word, even for a single giant sentence', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = splitIntoTexts(text, 30);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30);
      for (const w of chunk.split(' ')) {
        expect(words).toContain(w);
      }
    }
    expect(chunks.join(' ')).toBe(text);
  });

  it('keeps a single word longer than maxLen whole rather than splitting it', () => {
    const longWord = 'x'.repeat(50);
    const chunks = splitIntoTexts(longWord, 10);
    expect(chunks).toEqual([longWord]);
  });

  it('every chunk respects maxLen when possible', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Sentence number ${i} is fairly ordinary and short.`).join(' ');
    const chunks = splitIntoTexts(text, 120);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
    }
  });
});

describe('normalizePhone', () => {
  it('normalizes a bare 10-digit US number', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('normalizes a formatted US number', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
  });

  it('normalizes an 11-digit number with a leading 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('normalizes a number already carrying a country code and plus sign', () => {
    expect(normalizePhone('+1 555 123 4567')).toBe('+15551234567');
  });

  it('preserves a non-US country code', () => {
    expect(normalizePhone('+442071234567')).toBe('+442071234567');
  });

  it('returns null for too few digits', () => {
    expect(normalizePhone('12345')).toBeNull();
  });

  it('returns null for a 10-digit number with an invalid area code', () => {
    expect(normalizePhone('0551234567')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(normalizePhone('not a phone number')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });
});

describe('buildVCard', () => {
  it('builds a valid vCard 3.0 with CRLF line endings', () => {
    const card = buildVCard({ firstName: 'Ada', lastName: 'Lovelace', phone: '+15551234567' });
    expect(card).toContain('\r\n');
    expect(card.replace(/\r\n/g, '')).not.toContain('\n'); // every newline is part of a CRLF pair
    expect(card.startsWith('BEGIN:VCARD\r\n')).toBe(true);
    expect(card.endsWith('END:VCARD\r\n')).toBe(true);
    expect(card).toContain('VERSION:3.0\r\n');
    expect(card).toContain('N:Lovelace;Ada;;;\r\n');
    expect(card).toContain('FN:Ada Lovelace\r\n');
    expect(card).toContain('TEL;TYPE=CELL:+15551234567\r\n');
  });

  it('includes optional fields when provided', () => {
    const card = buildVCard({
      firstName: 'Remy',
      phone: '+15551234567',
      url: 'https://example.com',
      note: 'Your college agent',
      org: 'TBD',
    });
    expect(card).toContain('ORG:TBD\r\n');
    expect(card).toContain('URL:https://example.com\r\n');
    expect(card).toContain('NOTE:Your college agent\r\n');
    expect(card).toContain('FN:Remy\r\n');
    expect(card).toContain('N:;Remy;;;\r\n');
  });

  it('escapes commas, semicolons, and newlines in field values', () => {
    const card = buildVCard({ firstName: 'A;B,C', phone: '+15551234567', note: 'line1\nline2' });
    expect(card).toContain('A\\;B\\,C');
    expect(card).toContain('line1\\nline2');
  });
});

describe('tapbackToEmoji / emojiToTapback', () => {
  it('round-trips every classic tapback through its canonical emoji', () => {
    const tapbacks = ['love', 'like', 'dislike', 'laugh', 'emphasize', 'question'] as const;
    for (const t of tapbacks) {
      expect(emojiToTapback(tapbackToEmoji(t))).toBe(t);
    }
  });

  it('accepts a couple of common skin-tone variants for like/dislike', () => {
    expect(emojiToTapback('👍🏽')).toBe('like');
    expect(emojiToTapback('👎🏿')).toBe('dislike');
  });

  it('returns null for unrecognized input', () => {
    expect(emojiToTapback('🔥')).toBeNull();
    expect(emojiToTapback('not an emoji')).toBeNull();
  });
});
