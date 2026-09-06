'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PlacedNote } from '@/components/essays/anchor-notes';
import { cn } from '@/lib/utils';

const NOTE_GAP_PX = 8;

/**
 * Positions each anchored note at the top of the paragraph it refers to, in the margin column
 * beside the editor. There is no DOM range to draw a real overlay on top of (a `<textarea>` has no
 * addressable text nodes), so this measures a hidden mirror — a block rendered with the same
 * width and font metrics as the textarea, one child per paragraph — and reads each paragraph's
 * `offsetTop` off it. Notes anchored to the same (or a nearby) paragraph would otherwise overlap,
 * so a second pass pushes each one down past the bottom of the note above it once note heights are
 * known.
 *
 * The mirror's own top is not the textarea's top: this column starts below the request button and,
 * once feedback exists, the verdict/next-steps summary — content with no counterpart beside the
 * editor. Every wanted position is corrected by the live gap between this column's top and the
 * textarea's (both read with `getBoundingClientRect` on every pass) so a note ends up level with
 * its paragraph no matter how tall whatever precedes the column is. Recalculates on resize,
 * whenever the paragraphs or notes change (new content, new feedback round), and via a
 * `ResizeObserver` on the summary (`summaryRef`) for the cases that change its height without
 * touching paragraphs or notes — the request button's label changing while a previous round's
 * notes are still on screen, an error note appearing or clearing.
 */
export function AnchoredNotesColumn({
  editorRef,
  summaryRef,
  paragraphs,
  notes,
}: {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  /** Whatever renders above this column in the same margin column — observed for size changes
   * that don't come with new paragraphs or notes. Optional: without it, positions still recompute
   * on resize and on paragraph/note changes, just not on a summary-only height change. */
  summaryRef?: RefObject<HTMLElement | null>;
  paragraphs: string[];
  /** Only notes with a resolved `paragraphIndex` — general notes render elsewhere. */
  notes: PlacedNote[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const noteRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [tops, setTops] = useState<number[]>([]);
  const [columnHeight, setColumnHeight] = useState(0);

  useEffect(() => {
    let raf = 0;

    function measure() {
      const editor = editorRef.current;
      const mirror = mirrorRef.current;
      const container = containerRef.current;
      if (!editor || !mirror || !container) return;
      mirror.style.width = `${editor.clientWidth}px`;

      // How far this column's top has drifted below the textarea's top — subtracted back out of
      // every paragraph offset below so notes align with the real textarea, not with the mirror's
      // position inside a column that starts lower on the page.
      const drift = container.getBoundingClientRect().top - editor.getBoundingClientRect().top;

      const mirrorTop = mirror.getBoundingClientRect().top;
      const paragraphTops = Array.from(mirror.querySelectorAll<HTMLElement>('[data-paragraph]')).map((el) => el.getBoundingClientRect().top - mirrorTop);

      const wanted = notes.map((note) => (note.paragraphIndex !== null ? (paragraphTops[note.paragraphIndex] ?? 0) : 0) - drift);
      const order = notes.map((_, index) => index).sort((a, b) => wanted[a]! - wanted[b]!);
      const nextTops = new Array<number>(notes.length).fill(0);
      let cursor = 0;
      for (const index of order) {
        const top = Math.max(wanted[index]!, cursor);
        nextTops[index] = top;
        const height = noteRefs.current[index]?.getBoundingClientRect().height ?? 0;
        cursor = top + height + NOTE_GAP_PX;
      }
      setTops(nextTops);
      setColumnHeight(Math.max(mirror.scrollHeight, cursor));
    }

    // A first pass measures paragraph offsets; notes then render at those offsets and a second
    // (rAF) pass reads their real heights back to resolve any overlap.
    measure();
    raf = requestAnimationFrame(measure);

    function onResize() {
      measure();
    }
    window.addEventListener('resize', onResize);

    // Covers a summary height change that isn't accompanied by new paragraphs or notes (the
    // request button swapping its label while stale notes from a previous round are still shown).
    const summaryEl = summaryRef?.current;
    const summaryObserver = summaryEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (summaryEl && summaryObserver) summaryObserver.observe(summaryEl);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      summaryObserver?.disconnect();
    };
  }, [editorRef, summaryRef, paragraphs, notes]);

  if (notes.length === 0) return null;

  return (
    <div ref={containerRef} className="relative" style={{ minHeight: columnHeight }}>
      {/* Font classes must match `EssayEditor`'s textarea exactly, `lg:` prefix included: at the
          `lg` breakpoint the responsive `lg:text-17` rule (compiled into a later stylesheet block)
          overrides the plain `leading-[1.6]` rule's line-height with `text-17`'s own bundled one,
          and the mirror has to land on that same value or its paragraph offsets drift from the
          real textarea's by a few pixels per line. */}
      <div ref={mirrorRef} aria-hidden className="invisible absolute left-0 top-0 -z-10 px-3 py-2 font-ui text-14 leading-[1.6] lg:text-17">
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            <div data-paragraph className="whitespace-pre-wrap break-words">
              {paragraph}
            </div>
            {index < paragraphs.length - 1 ? <div>&nbsp;</div> : null}
          </div>
        ))}
      </div>
      {notes.map((note, index) => (
        <div
          key={index}
          ref={(el) => {
            noteRefs.current[index] = el;
          }}
          className="group absolute left-0 w-full rounded bg-s1 p-3"
          style={{ top: tops[index] ?? 0 }}
        >
          <p className="text-12 text-fg-2">{note.categoryLabel}</p>
          <p className="text-14 text-fg">{note.note}</p>
          {note.quote ? (
            <p className={cn('mt-1 hidden text-12 italic text-fg-3 group-hover:block')}>&ldquo;{note.quote}&rdquo;</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
