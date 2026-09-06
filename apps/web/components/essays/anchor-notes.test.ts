import { describe, expect, it } from 'vitest';
import { findParagraphForQuote, groupNotesByParagraph, placeNotes, splitParagraphs } from '@/components/essays/anchor-notes';

const PARAGRAPHS = [
  'Every night at the taqueria I translate the specials board and the ticket times.',
  'At school I run the newsroom the way I run the pass on a Friday rush.',
  'I want to study journalism because it is organized translation, plain and simple.',
];

describe('splitParagraphs', () => {
  it('splits on one or more blank lines and trims each paragraph', () => {
    expect(splitParagraphs('First.\n\nSecond.\n\n\nThird.')).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('is empty for empty or whitespace-only text', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('   \n\n  ')).toEqual([]);
  });

  it('is a single paragraph with no blank line', () => {
    expect(splitParagraphs('One line.\nStill the same paragraph.')).toEqual(['One line.\nStill the same paragraph.']);
  });
});

describe('findParagraphForQuote', () => {
  it('finds the paragraph containing the quote', () => {
    expect(findParagraphForQuote(PARAGRAPHS, 'run the newsroom')).toBe(1);
  });

  it('is null with no quote', () => {
    expect(findParagraphForQuote(PARAGRAPHS, null)).toBeNull();
  });

  it('is null when no paragraph contains the quote', () => {
    expect(findParagraphForQuote(PARAGRAPHS, 'a phrase that never appears')).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(findParagraphForQuote(PARAGRAPHS, 'ORGANIZED TRANSLATION')).toBe(2);
  });

  it('picks the first matching paragraph when the quote appears in more than one', () => {
    const paragraphs = ['I translate every night.', 'I translate again here, differently.'];
    expect(findParagraphForQuote(paragraphs, 'i translate')).toBe(0);
  });
});

describe('placeNotes', () => {
  it('anchors notes with a matching quote and leaves the rest general, in category order', () => {
    const placed = placeNotes(PARAGRAPHS, {
      clarity: [{ quote: 'run the newsroom', note: 'Say what you mean by "pass" for a reader who has never worked a line.' }],
      structure: [],
      generic_phrase: [{ quote: null, note: 'No specific phrase flagged.' }],
      real_detail: [{ quote: 'not in the draft anywhere', note: 'Could not find this quote.' }],
    });

    expect(placed).toHaveLength(3);
    expect(placed[0]).toMatchObject({ category: 'clarity', categoryLabel: 'Clarity', paragraphIndex: 1 });
    expect(placed[1]).toMatchObject({ category: 'generic_phrase', paragraphIndex: null });
    expect(placed[2]).toMatchObject({ category: 'real_detail', paragraphIndex: null });
  });
});

describe('groupNotesByParagraph', () => {
  it('groups anchored notes by paragraph (1-based label) in order, with general last', () => {
    const placed = placeNotes(PARAGRAPHS, {
      clarity: [{ quote: 'organized translation', note: 'Clarity note.' }],
      structure: [{ quote: 'run the newsroom', note: 'Structure note.' }],
      generic_phrase: [{ quote: null, note: 'General note.' }],
      real_detail: [],
    });

    const groups = groupNotesByParagraph(placed);
    expect(groups.map((g) => g.label)).toEqual(['Paragraph 2', 'Paragraph 3', 'General']);
    expect(groups[0]!.notes).toHaveLength(1);
    expect(groups[0]!.notes[0]!.note).toBe('Structure note.');
  });

  it('is a single general group when nothing is anchored', () => {
    const placed = placeNotes(PARAGRAPHS, { clarity: [], structure: [], generic_phrase: [{ quote: null, note: 'x' }], real_detail: [] });
    expect(groupNotesByParagraph(placed)).toEqual([{ label: 'General', notes: placed }]);
  });
});
