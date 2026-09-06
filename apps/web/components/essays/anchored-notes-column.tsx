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
 * known. Recalculates on resize and whenever the paragraphs or notes change (new content, new
 * feedback round).
 */
export function AnchoredNotesColumn({
  editorRef,
  paragraphs,
  notes,
}: {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  paragraphs: string[];
  /** Only notes with a resolved `paragraphIndex` — general notes render elsewhere. */
  notes: PlacedNote[];
}) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const noteRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [tops, setTops] = useState<number[]>([]);
  const [columnHeight, setColumnHeight] = useState(0);

  useEffect(() => {
    let raf = 0;

    function measure() {
      const editor = editorRef.current;
      const mirror = mirrorRef.current;
      if (!editor || !mirror) return;
      mirror.style.width = `${editor.clientWidth}px`;

      const mirrorTop = mirror.getBoundingClientRect().top;
      const paragraphTops = Array.from(mirror.querySelectorAll<HTMLElement>('[data-paragraph]')).map((el) => el.getBoundingClientRect().top - mirrorTop);

      const wanted = notes.map((note) => (note.paragraphIndex !== null ? (paragraphTops[note.paragraphIndex] ?? 0) : 0));
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
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [editorRef, paragraphs, notes]);

  if (notes.length === 0) return null;

  return (
    <div className="relative" style={{ minHeight: columnHeight }}>
      <div ref={mirrorRef} aria-hidden className="invisible absolute left-0 top-0 -z-10 px-3 py-2 font-ui text-17 leading-[1.6]">
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
