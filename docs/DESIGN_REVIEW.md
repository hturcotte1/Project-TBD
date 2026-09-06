# Design review

Every screenshot in `docs/screenshots` is reviewed by the orchestrator against this checklist before its page is accepted, and again in a full second pass once every page exists. Notes are kept here, newest pass last. A finding is a sentence about what is wrong on the screen; a fix is what was changed.

## Checklist

1. Time first: is the days-remaining number the first thing the eye lands on where a deadline exists, set in Bricolage, tabular, colored by the heat scale and nothing else?
2. Density: rows and tables, one column, detail by opening a row. No cards, no card inside a card, no tile grid, no colored left strip, no tinted row background except hover or selected.
3. Color: every color is a token. Surfaces get lighter as they come forward. Brand blue appears only in chrome (wordmark, selection, focus, the one primary button, links). Heat appears only on type and thin bars. No green for "far", no red pills, nothing pure black in dark, no pure-white-on-white in light without a step between.
4. Type: Hanken for everything but the numerals; sizes from the scale only; no all-caps, no letterspaced labels, no eyebrows, no middle dots, no arrows, no single colored word in a sentence, no exclamation points from the interface. Measure under 80 characters.
5. Chrome: hairlines only under table headers, around inputs, beside the rail, above the tab bar, above the composer. One shadow, on floating surfaces only. Two radii, hierarchy visible.
6. Motion: nothing moves on load except the countdown settle; expansions, drawers and removals answer an action; reduced motion respected.
7. Keyboard and touch: visible focus on every interactive element, inset on rows; rows 40px desktop and 48px mobile; the page never scrolls horizontally at 390px; dropped columns reappear in the expansion.
8. Copy: sentence case, verbs on buttons, dates as dates, empty states as one sentence and one link, errors that say what happened and what to do.
9. Both themes: the light theme reads as designed, not inverted; contrast per DESIGN.md.
10. Distinctiveness: would this screen be mistaken for a shadcn or admin-template dashboard? If yes, it is not done.

## Pass 1, component system (`/dev/system`)

Reviewed `system-{390,1280}-{dark,light}.png` and `system-palette-*`.

- Finding: heat steps 1 to 4 rendered in body white on both `Countdown` and `DaysFigure`; only step 5 was colored. Cause: the class names live in `lib/urgency.ts`, which Tailwind's content globs did not scan, so `text-heat-1` to `text-heat-4` were never generated (step 5 happened to appear in a test string). Fix: `lib/**` added to the content globs. Verified in the re-shot: 20 straw, 12 amber, 6 and 2 orange, overdue coral, in both themes.
- Finding: the label under the page-size countdown was captured mid-fade (grey instead of body text) because the runner waited a fixed 700ms and the settle plus fade takes 800ms. Fix: the numeral now carries `data-settling` while it counts and the runner waits for that attribute to clear and for every finite CSS animation to finish.
- Finding: the command palette's input showed a focus ring clipped by the dialog's top edge. Fix: the ring is inset for that input.
- Finding: tertiary text on Surface 3 (the magnifier and placeholder in the palette, the toast's close icon), against the contrast rule. Fix: secondary text there.
- Finding: Next's dev-mode badge in the corner of every screenshot. Fix: `devIndicators: false`.
- Finding: the kitchen sink's own descriptions used spaced em dashes as label separators, the pattern DESIGN.md rules out. Fix: rewritten as sentences.
- Accepted as is: the sink's five-column demo table wraps badly at 390px; real pages drop columns on mobile per the page specs, and the table primitive is correct.
- Passed: Hanken and Bricolage load (asserted by the runner); the dark page reads blue-slate, not black; the light theme has a visible step between page and rail; buttons show one filled primary per group; two radii read as two levels; the one shadow appears only on the palette; focus ring visible on inputs, buttons and rows.
