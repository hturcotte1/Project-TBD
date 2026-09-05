# Apogee design

This is the design plan for the Apogee web app. It was written before any component was touched, reviewed against the generic default (see the last section), and is the reference every screen is checked against. Every color, size, radius and shadow used in `apps/web` comes from `apps/web/app/tokens.css`; Tailwind maps to those variables and nothing else.

## Concept

Apogee is a flight deck for a launch with a hard date. The primary object on every screen is time: how many days until the next deadline, and what has to happen before it. The one memorable element is the countdown, set as typography: a large tabular numeral for days remaining on Today and in every school header, with the sentence that explains it directly underneath. Everything around the number is quiet, dense and legible: rows not cards, tables not tiles, one column of content that reads top to bottom, and detail that appears only when a row is opened. The palette is the sky at 40,000 feet: a deep, desaturated blue-slate that gets lighter as surfaces come toward you, an ice-blue used only in the chrome, and a single warm signal that heats up as a deadline approaches. Nothing celebrates. Success is a quiet check; errors are plain sentences.

## Color

Dark is the base theme. Light is designed to the same rules, not derived by inversion.

### Base values (dark)

| Name | Hex | Role |
|---|---|---|
| Page | `#141D2B` | The ground. Body text sits directly on it. |
| Surface 1 | `#1B2634` | Rail, table header row, panel that must read as "a thing". |
| Surface 2 | `#233041` | Hover and selected rows, inputs, the selected rail item. |
| Surface 3 | `#2C3A4D` | Floating surfaces only: command palette, drawers, menus, sheets. |
| Text | `#E8EDF4` | Body and headings. |
| Ice (brand) | `#A3C4E6` | Wordmark, selected rail item, focus ring, the one primary button per screen, links. Never for status. |

Supporting text: secondary `#A9B6C7` (meta that must still be read: dates, reasons), tertiary `#8A9AAE` (meta the eye can skip: timestamps, counts). Hairline `#2F3D50`; strong line `#3E4E64` (input outline, table header rule).

### Base values (light)

| Name | Hex | Role |
|---|---|---|
| Page | `#F3F5F8` | The ground. |
| Surface 1 | `#FFFFFF` | Rail, table header, panels. |
| Surface 2 | `#E9EDF2` | Hover and selected rows, inputs. |
| Surface 3 | `#DDE3EA` | Floating surfaces (with the one shadow). |
| Text | `#18222F` | Body and headings. |
| Brand | `#2E5A8A` | Same roles as ice in dark. |

Secondary `#4A5A6E`, tertiary `#5C6979`, hairline `#D5DCE5`, strong line `#B9C3D0`.

In light, the rail is white on a `#F3F5F8` page, so elevation still reads as "lighter is closer": the page is the darkest broad surface and floating surfaces are the lightest after the rail.

### One signal: heat

Urgency uses one warm signal that heats from straw to ember. It is applied to numbers and text, occasionally to a thin bar, never to filled pills or backgrounds. Far deadlines carry no signal at all; they are set in secondary text. Green is not an urgency value.

| Step | Days remaining | Dark | Light |
|---|---|---|---|
| 0 | more than 30 | secondary text | secondary text |
| 1 | 15 to 30 | `#B99A6C` | `#7D5A2C` |
| 2 | 8 to 14 | `#D9A75C` | `#8C5612` |
| 3 | 4 to 7 | `#EE9C42` | `#9E4C0C` |
| 4 | 0 to 3 | `#F5843C` | `#AA4210` |
| 5 | overdue | `#FF7A55` | `#AD3220` |

Outcomes: ok `#8FB89A` / `#2F6B3E` (a small check, never a banner); error `#E68A8A` / `#A83434` (plain text next to the thing that failed).

### Contrast

Body text is 14px regular. Every foreground below clears 4.5:1 on the surfaces it is allowed on; the table is the rule, not a target.

Dark theme, ratio against Page / Surface 1 / Surface 2 / Surface 3:

| Foreground | Page | S1 | S2 | S3 | Allowed on |
|---|---|---|---|---|---|
| Text `#E8EDF4` | 14.39 | 13.00 | 11.37 | 9.81 | all |
| Secondary `#A9B6C7` | 8.23 | 7.43 | 6.50 | 5.61 | all |
| Tertiary `#8A9AAE` | 5.90 | 5.33 | 4.66 | 4.02 | Page, S1, S2 |
| Ice `#A3C4E6` | 9.35 | 8.44 | 7.38 | 6.37 | all |
| Heat 1 `#B99A6C` | 6.37 | 5.75 | 5.03 | 4.34 | Page, S1, S2 |
| Heat 2 `#D9A75C` | 7.77 | 7.01 | 6.13 | 5.29 | all |
| Heat 3 `#EE9C42` | 7.63 | 6.89 | 6.03 | 5.20 | all |
| Heat 4 `#F5843C` | 6.65 | 6.01 | 5.25 | 4.53 | all |
| Heat 5 `#FF7A55` | 6.58 | 5.95 | 5.20 | 4.49 | Page, S1, S2 |
| Ok `#8FB89A` | 7.65 | 6.91 | 6.04 | 5.22 | all |
| Error `#E68A8A` | 6.75 | 6.09 | 5.33 | 4.60 | all |
| Page text on Ice button `#141D2B` on `#A3C4E6` | 9.35 | | | | |

Light theme:

| Foreground | Page | S1 | S2 | S3 | Allowed on |
|---|---|---|---|---|---|
| Text `#18222F` | 14.69 | 16.05 | 13.65 | 12.42 | all |
| Secondary `#4A5A6E` | 6.45 | 7.05 | 6.00 | 5.46 | all |
| Tertiary `#5C6979` | 5.12 | 5.60 | 4.76 | 4.33 | Page, S1, S2 |
| Brand `#2E5A8A` | 6.53 | 7.13 | 6.06 | 5.52 | all |
| Heat 1 `#7D5A2C` | 5.70 | 6.23 | 5.30 | 4.82 | all |
| Heat 2 `#8C5612` | 5.57 | 6.08 | 5.17 | 4.70 | all |
| Heat 3 `#9E4C0C` | 5.50 | 6.01 | 5.11 | 4.65 | all |
| Heat 4 `#AA4210` | 5.50 | 6.01 | 5.11 | 4.65 | all |
| Heat 5 `#AD3220` | 5.91 | 6.45 | 5.49 | 4.99 | all |
| Ok `#2F6B3E` | 5.84 | 6.38 | 5.42 | 4.93 | all |
| Error `#A83434` | 6.00 | 6.55 | 5.57 | 5.07 | all |
| White on Brand button | 7.13 | | | | |

Rule that follows from the table: floating surfaces (Surface 3) never carry tertiary text or heat 1 or 5 in dark; they use secondary text and heat 2 to 4.

## Type

Two families, clearly different jobs.

**Hanken Grotesk** (variable, 100 to 900, self-hosted) is the interface: body, tables, headings, buttons, the rail. It has real tabular figures by default (verified by measurement: `111` and `000` render at the same width), a slightly wide, open lowercase that stays legible at 12px in a dense table, and none of the "generated page" signature that Inter and its cousins carry. Weights used: 400 body, 500 for the first column of a row and for buttons, 600 for headings. No 300, no 700 and up.

**Bricolage Grotesque** (variable, 200 to 800, self-hosted) is the countdown and nothing else: the days-remaining numeral on Today and in school headers, and the small numeral in the Schools table. Weight 600, tracking -0.03em, `font-variant-numeric: tabular-nums` so the number does not jitter as it settles. Its narrow, slightly eccentric figures are the only display personality on the page, and they are the one place the design spends boldness.

Monospace is the system stack (`ui-monospace`, SF Mono, Menlo, Consolas) and appears only for literal identifiers: job ids, run ids, the verification-code input.

### Bake-off

Rendered in Chromium at 14px body and 84px numerals, dark theme, real content ("Ask Ms. Park to submit your Michigan rec", "57 days until Michigan, Early Action", a table row with `2,140` and `180/300`): Instrument Sans, Hanken Grotesk, Schibsted Grotesk, Host Grotesk, Familjen Grotesk, Onest, Public Sans, IBM Plex Sans for the interface; Bricolage Grotesque, Familjen Grotesk and Schibsted Grotesk for the numeral.

- Instrument Sans: pleasant, but at 14px it is Inter with rounder terminals; rejected as too close to the default.
- Schibsted Grotesk: good tabular figures, but its heavy, tight rhythm makes a 40px table row feel crowded.
- Host Grotesk: lovely display, weak below 14px.
- Familjen Grotesk: character in the numerals, but the lowercase is too quirky for 300 rows of checklist.
- Onest, Public Sans, IBM Plex Sans: competent and anonymous; nothing to choose them for.
- Hanken Grotesk: the calmest body of the set, wide enough to keep 12px meta readable, tabular by default. Chosen.
- Bricolage Grotesque for the numeral: at 84px, weight 600, it reads as a number on an instrument rather than a headline. Familjen was second. Chosen.

### Scale

Base 14px, ratio 1.25 (a major third), rounded to whole pixels; line heights on the 4px grid.

| Token | Size / line | Use |
|---|---|---|
| `text-12` | 12 / 16 | meta, table secondary column, tab bar labels |
| `text-14` | 14 / 20 | body, table cells, buttons, inputs |
| `text-17` | 17 / 24 | lead sentence under a countdown, section titles inside a page |
| `text-22` | 22 / 28 | page title on mobile, drawer title |
| `text-28` | 28 / 34 | page title on desktop |
| `text-34` | 34 / 40 | school-name header on detail pages |
| `text-43` | 43 / 48 | Schools table countdown numeral (Bricolage) |
| `text-54` | 54 / 56 | school header countdown, mobile Today countdown fallback |
| `text-67` | 67 / 68 | Today countdown at 390px (Bricolage) |
| `text-84` | 84 / 84 | Today countdown at 1280px (Bricolage) |

Measure: body copy and prose requirements are capped at 64ch. Tables may run the full content width. Headings are sentence case. No all-caps, no letterspaced labels, no eyebrows above headings.

## Spacing, rows, radii

Spacing scale, in px: 4, 8, 12, 16, 24, 32, 48, 64. Tailwind's default 4px grid is kept for `p-`/`m-`/`gap-` so these are `1, 2, 3, 4, 6, 8, 12, 16`; anything off the scale (`p-5`, `p-7`) is a review finding.

Rows are 40px on desktop and 48px on mobile (touch). A table is a stack of rows with a 1px hairline under the header only; rows separate by their own hover surface, not by borders.

Two radii. `rounded` (6px) for anything that sits in the flow: buttons, inputs, selected rows, segments of a bar. `rounded-lg` (12px) for anything that floats: command palette, drawers, sheets, menus, the toast. The difference is the hierarchy: a 12px corner means "this is above the page". `rounded-full` exists only for avatars and the two caps of the progress bar.

## Elevation

Elevation is a lighter surface, not a shadow. Page < Surface 1 < Surface 2 < Surface 3, and each step is used for what the table above says. There is exactly one shadow, `shadow-float`, and it may appear only on Surface 3 elements that float above the page (palette, drawer, menu, toast). Nothing else has a shadow. Nothing has a border for decoration: hairlines appear in five places only (under a table header, around an input, between the rail and the page, above the mobile tab bar, and between the composer and the thread in Vector). No card inside a card, no colored left strip, no tinted background behind a row.

## Structure

Desktop (1024px and up): a left rail, 232px, collapsible to 56px (icons only, labels in tooltips). Wordmark at the top. Nav in this order: Today, Schools, Essays, Recommenders, Timeline, Vector, Activity. The student's name at the bottom opens a menu with Profile, Settings, Admin (when admin), Theme, Sign out. Content is one column, left-aligned, max 1040px, 32px page padding.

Mobile (below 1024px): a bottom tab bar, 56px plus safe area, with Today, Schools, Essays, Vector, Search. Search opens the command palette. Recommenders, Timeline and Activity are reached from the palette and from links on Today and school pages; the student menu lives behind the name in the page header. Content has 16px padding.

Command palette: ⌘K or Ctrl-K anywhere; the search icon on mobile. It searches schools, essays, recommenders, next actions and pages, and it exposes the same actions as the page (open, mark done, snooze, sync now). Surface 3, `rounded-lg`, `shadow-float`, the one place a shadow appears in normal use.

Loading: a single 2px progress bar at the top of the content column, in Ice, while data is in flight. No skeleton shimmer anywhere. When a page has data, it renders it; when it does not, it renders an empty state that is one sentence and one link.

## Today

The page order is fixed: countdown, then the approval row if anything is waiting, then the queue, then what changed, then the last thing Vector said.

### 1280px

```
+--------------+----------------------------------------------------------------------+
| Apogee       |  Today                                    Thursday, September 5      |
|              |                                                                      |
| > Today      |  57                                                                  |
|   Schools    |  days until Michigan, Early Action.                                  |
|   Essays     |  Then Georgia Tech in 59 and Purdue in 60.                           |
|   Recommend. |                                                                      |
|   Timeline   |  Waiting on you                                                      |
|   Vector     |  Three activity descriptions for Michigan, drafted from your resume  |
|   Activity   |                                       Review    Approve all   Skip   |
|              |                                                                      |
|              |  Queue                                                               |
|              |  1  Ask Ms. Park to submit your Michigan rec         Michigan    2   |
|              |  2  Finish the Why Michigan supplement, 180 of 300   Michigan   12   |
|              |  3  Send your Georgia Tech transcript request         Georgia Tech  14|
|              |  4  Confirm your SAT score report for Purdue          Purdue     15  |
|              |  5  Draft the Purdue honors essay                     Purdue     15  |
|              |     j and k to move, e to open, s to snooze                          |
|              |                                                                      |
|              |  Since yesterday                                                     |
|              |  Common App marked your Purdue transcript as received.               |
|              |  Michigan added an optional interview to its checklist.              |
|              |                                                                      |
|              |  Vector                                                              |
|              |  "Ms. Park hasn't submitted yet. Want me to draft a nudge?"   Reply  |
| Dee Demo     |                                                                      |
+--------------+----------------------------------------------------------------------+
```

The number is `text-84`, Bricolage, heat step 0 (secondary) when far and the heat step of the deadline when near. The line under it is `text-17` regular, text color. The "then" sentence is `text-14` secondary. The queue is a table: rank in tertiary, action in text weight 500, school in secondary, days in tabular figures colored by heat. Hover lifts a row to Surface 2. Keyboard focus is a 2px Ice outline inset on the row.

### 390px

```
+------------------------------------+
|  Today             Thu, Sep 5      |
|                                    |
|  57                                |
|  days until Michigan, Early Action.|
|  Then Georgia Tech in 59 and       |
|  Purdue in 60.                     |
|                                    |
|  Waiting on you                    |
|  Three activity descriptions for   |
|  Michigan                  Review  |
|                                    |
|  Queue                             |
|  1  Ask Ms. Park to submit your  2 |
|     Michigan rec                   |
|  2  Finish the Why Michigan     12 |
|     supplement, 180 of 300         |
|  3  Send your Georgia Tech      14 |
|     transcript request             |
|                                    |
|  Since yesterday                   |
|  Common App marked your Purdue     |
|  transcript as received.           |
|                                    |
|  Vector                            |
|  "Ms. Park hasn't submitted yet.   |
|  Want me to draft a nudge?"        |
|                                    |
+------------------------------------+
|  Today  Schools  Essays  Vector  Q |
+------------------------------------+
```

At 390px the number is `text-67`, rows are 48px with the action wrapping to two lines and the days figure pinned right, and the school name is dropped from the row (it is in the action sentence or one tap away).

## Motion

One orchestrated moment: when Today loads, the countdown settles. The numeral starts at the previous session's value (or a nearby value on first load) and counts to the real number over 600ms with a settle ease; the sentence beneath fades in as it lands. Nothing else animates on load.

Motion that answers an action is welcome and short (120ms to 200ms): a row expanding to show evidence, a drawer sliding in from the right, a queue row leaving after "done", the typing indicator in Vector. Hover has no transition on color; it changes on the frame it happens.

`prefers-reduced-motion: reduce` removes the countdown settle (the number renders at its final value), replaces slides with fades, and keeps the typing indicator static.

## Principles

1. Time first. Every screen answers "how long do I have" before anything else, in a number set to be read from across the room.
2. Density is a feature. Rows, tables, one column. Detail is revealed by opening a row, not by another card.
3. One signal. Warm heat means "closer to a deadline" and means nothing else. Brand blue means "this is Apogee" and never means status.
4. Elevation is light. Closer surfaces are lighter; borders and shadows are exceptions with a written list.
5. Words are plain. Sentences in sentence case, verbs on buttons, dates as dates, no exclamation points from the interface.
6. Quiet success. A check, a sentence, nothing that moves.

## What I changed after reviewing this against the default

I wrote the plan, then produced the version of this dashboard I would have built with no brief, and compared.

1. **The countdown left its card.** The default puts a big number in a card with a small caps label above it and a progress ring beside it. Now the number sits directly on the page, with the explanation as a sentence below it in body size, and no ring anywhere. The number is the hero, so it gets no frame.
2. **Urgency stopped being a traffic light.** The default is red, amber and green pills. Green was removed from the vocabulary entirely (a far deadline is silent, not "good"), the two remaining colors became one warm hue in six steps, and it is applied to type and thin bars, never to filled badges.
3. **The dark theme stopped being near-black plus neon.** The first sketch had a `#0F1219` page and a bright cyan accent. The page moved to a blue-slate that is visibly not black, surfaces got lighter as they come forward, and the accent became a pale ice used only in chrome, so the heat scale is the only saturated thing on the page.
4. **Instrument Sans lost to Hanken Grotesk.** The plan named Instrument Sans; rendered at 14px it read as the same page as every other new dashboard. The bake-off is above.
5. **The rail lost its badges.** Count badges next to every nav item are the default; they were removed. Today owns the numbers. The rail just says where you are.
6. **Buttons lost their fill.** The default fills every primary button in brand blue. There is now one filled button per screen (the thing the page most wants you to do); every other action is text-weight with an underline on hover.
7. **Empty states lost their illustration.** Icon in a circle, headline, subtitle, button became one sentence and one link, in the page's own voice.

## Accessibility

- Contrast: see the tables above. Body text is at least 5.1:1 on every surface it appears on in both themes; the smallest ratio permitted anywhere is 4.5:1 for tertiary meta on Surface 2.
- Focus: every interactive element shows a 2px Ice (Brand in light) outline with 2px offset via `:focus-visible`; rows use an inset outline so it is not clipped by the table.
- Reduced motion: honored globally (see Motion). No animation is required to understand state.
- Keyboard: the queue supports j, k, e and s; the palette opens with ⌘K and Ctrl-K; every drawer traps focus and closes on Escape; the tab bar and rail are reachable by Tab in reading order.
- Touch: rows are 48px on mobile; tap targets are never under 40px.

## Copy

Sentence case everywhere. Buttons are verbs ("Approve", "Snooze a week", "Sync now"). Dates are written as dates ("in 12 days", "Nov 1"). Empty states say what to do next. Errors say what happened and what to do, without apologizing. The interface never uses an exclamation point; Vector uses at most one per conversation.
