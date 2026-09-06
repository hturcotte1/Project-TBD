/**
 * Anchors feedback notes to the paragraph of the draft they're about, so the editor can show them
 * in the margin next to the text they refer to instead of in one undifferentiated list. A note
 * with no quote, or a quote that doesn't appear anywhere in the draft, is "general" (not anchored
 * to any paragraph) — never an error, since a model's note is still useful without a precise spot.
 */

export type NoteCategory = 'clarity' | 'structure' | 'generic_phrase' | 'real_detail';

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  clarity: 'Clarity',
  structure: 'Structure',
  generic_phrase: 'Generic phrase',
  real_detail: 'A real detail',
};

export interface RawNote {
  quote: string | null;
  note: string;
}

export interface PlacedNote extends RawNote {
  category: NoteCategory;
  categoryLabel: string;
  /** Zero-based index into the paragraph array this note is anchored to, or null when general. */
  paragraphIndex: number | null;
}

/** Splits a draft into paragraphs on one or more blank lines. Empty (or whitespace-only) text has
 * no paragraphs. */
export function splitParagraphs(content: string): string[] {
  return content
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The index of the first paragraph containing `quote`, case-insensitively — or null when there's
 * no quote to match, or no paragraph contains it. */
export function findParagraphForQuote(paragraphs: string[], quote: string | null): number | null {
  if (!quote) return null;
  const needle = quote.trim().toLowerCase();
  if (!needle) return null;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i]!.toLowerCase().includes(needle)) return i;
  }
  return null;
}

/** Places every note from the four anchorable feedback categories against the draft's paragraphs,
 * in category order (clarity, structure, generic phrase, real detail), preserving each category's
 * own order within it. */
export function placeNotes(paragraphs: string[], notesByCategory: Record<NoteCategory, RawNote[]>): PlacedNote[] {
  const categories: NoteCategory[] = ['clarity', 'structure', 'generic_phrase', 'real_detail'];
  const out: PlacedNote[] = [];
  for (const category of categories) {
    for (const raw of notesByCategory[category]) {
      out.push({ ...raw, category, categoryLabel: NOTE_CATEGORY_LABELS[category], paragraphIndex: findParagraphForQuote(paragraphs, raw.quote) });
    }
  }
  return out;
}

export interface NoteGroup {
  label: string;
  notes: PlacedNote[];
}

/** Groups placed notes by paragraph ("Paragraph 2", 1-based for display) in paragraph order, with
 * any general (unanchored) notes in one final group — the shape the mobile feedback sheet lists. */
export function groupNotesByParagraph(notes: PlacedNote[]): NoteGroup[] {
  const byParagraph = new Map<number, PlacedNote[]>();
  const general: PlacedNote[] = [];
  for (const note of notes) {
    if (note.paragraphIndex === null) {
      general.push(note);
      continue;
    }
    const existing = byParagraph.get(note.paragraphIndex);
    if (existing) existing.push(note);
    else byParagraph.set(note.paragraphIndex, [note]);
  }
  const groups: NoteGroup[] = [...byParagraph.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, groupNotes]) => ({ label: `Paragraph ${index + 1}`, notes: groupNotes }));
  if (general.length > 0) groups.push({ label: 'General', notes: general });
  return groups;
}
