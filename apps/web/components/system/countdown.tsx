'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { heatStep, heatTextClass } from '@/lib/urgency';
import { cn } from '@/lib/utils';

// Plain useLayoutEffect warns when it runs during SSR (it does nothing there, by design — but
// this is still a Server Component-rendered Client Component the first time around). useEffect
// is a fine stand-in for that one pass since there's nothing to lay out on the server anyway.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type CountdownSize = 'page' | 'header' | 'row';

export interface CountdownProps {
  days: number | null;
  size: CountdownSize;
  /** The sentence beneath the numeral — composed by the caller, who knows the school/deadline. */
  label?: ReactNode;
  /** Defaults to true only for `size="page"`: DESIGN.md's "one orchestrated moment" is Today's
   * numeral, not every countdown on the page. */
  settle?: boolean;
}

const SIZE_CLASSES: Record<CountdownSize, string> = {
  page: 'text-67 lg:text-84',
  header: 'text-54',
  row: 'text-43',
};

const SETTLE_MS = 600;
const SETTLE_LOOKBACK = 12;

/** The non-negative day count a caller needs to build its own "3 days overdue" sentence. */
export function absDays(days: number | null): number | null {
  return days === null ? null : Math.abs(days);
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// A hand-rolled cubic-bezier solver so the JS-driven settle count uses the exact curve
// --ease-settle names (cubic-bezier(0.2, 0.8, 0.2, 1)) rather than approximating it with an
// easing keyword — the standard Newton-Raphson-with-bisection-fallback algorithm browsers use.
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const ax = 3 * p1x - 3 * p2x + 1;
  const bx = 3 * p2x - 6 * p1x;
  const cx = 3 * p1x;
  const ay = 3 * p1y - 3 * p2y + 1;
  const by = 3 * p2y - 6 * p1y;
  const cy = 3 * p1y;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      const d = sampleDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      if (dx > 0) hi = t;
      else lo = t;
      t = (hi + lo) / 2;
    }
    return t;
  }

  return (x: number) => sampleY(solveX(x));
}

const settleEase = cubicBezier(0.2, 0.8, 0.2, 1);

/**
 * Time first: a big tabular numeral, heat-colored, with an optional sentence underneath. Renders
 * "–" with no deadline; overdue deadlines still render as a positive number (see `absDays`), the
 * "overdue" wording being the caller's to write. `size="page"` counts up from a nearby value on
 * mount as the one orchestrated animation on the page; every other read of this component is
 * static.
 */
export function Countdown({ days, size, label, settle: settleProp }: CountdownProps) {
  const settle = settleProp ?? size === 'page';
  const target = absDays(days);
  const willSettle = target !== null && settle;

  // The initial state deliberately ignores prefers-reduced-motion: the server can't see it, so
  // seeding state from it would make the client's first render disagree with the server's, and
  // React can't always patch that up through Radix-style imperative attributes (reproduced with
  // the same pattern in the theme control — see lib/theme.ts). Reduced motion is instead applied
  // a moment later in useLayoutEffect, before the browser's next paint.
  const [display, setDisplay] = useState<number | null>(() => {
    if (!willSettle || target === null) return target;
    return Math.max(0, target - SETTLE_LOOKBACK);
  });
  const [animating, setAnimating] = useState(willSettle);
  const [labelVisible, setLabelVisible] = useState(!willSettle);

  useIsomorphicLayoutEffect(() => {
    // The settle is a one-time "on load" moment (empty deps), not something later prop updates
    // re-trigger. No "already ran" ref guard here: React Strict Mode runs mount effects twice in
    // development, and a guard would let the first run's cleanup cancel the frame loop for good.
    if (!willSettle || target === null || prefersReducedMotion()) {
      setDisplay(target);
      setAnimating(false);
      setLabelVisible(true);
      return;
    }

    const start = Math.max(0, target - SETTLE_LOOKBACK);
    const startTime = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / SETTLE_MS);
      setDisplay(Math.round(start + (target - start) * settleEase(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setAnimating(false);
        setLabelVisible(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []); // deliberately mount-only, see comment above

  const step = heatStep(days);
  // Far-off numerals read as body text, not muted meta, on the two big sizes; the row size
  // (Schools table) keeps the quieter secondary color heatTextClass already gives at step 0.
  const colorClass = step === 0 && size !== 'row' ? 'text-fg' : heatTextClass(days);
  const numeralValue = animating ? display : target;
  const numeralText = numeralValue === null ? '–' : String(numeralValue);
  const resolvedLabel = label ?? (days === null ? 'no deadline' : undefined);

  return (
    <div>
      <div
        className={cn('font-count font-semibold tracking-[-0.03em] tabular-nums', SIZE_CLASSES[size], colorClass)}
        aria-live="off"
        aria-label={target === null ? 'no deadline' : `${target} days`}
        data-settling={animating ? 'true' : undefined}
      >
        {numeralText}
      </div>
      {resolvedLabel !== undefined ? (
        <div className={cn('text-14 text-fg', labelVisible ? 'animate-fade-in' : 'opacity-0')}>{resolvedLabel}</div>
      ) : null}
    </div>
  );
}
