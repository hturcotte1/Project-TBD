'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressTopProps {
  active: boolean;
  className?: string;
}

/** Global CSS zeroes animation durations under reduced motion, but a zero-duration slide would
 * just end on its last keyframe (off to the right) rather than reading as "loading" — so this
 * swaps to a genuinely static, full-width bar instead of trusting the CSS override alone. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** The one loading indicator in the app: a 2px Ice bar at the top of the content column. No
 * skeletons, nowhere else. */
export function ProgressTop({ active, className }: ProgressTopProps) {
  const reducedMotion = usePrefersReducedMotion();
  if (!active) return null;

  return (
    <div className={cn('absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden', className)} role="progressbar" aria-busy="true" aria-label="Loading">
      {reducedMotion ? <div className="h-full w-full bg-brand" /> : <div className="h-full w-1/3 animate-progress-slide bg-brand" />}
    </div>
  );
}

/** Mount once per page (or once globally, pinned to the viewport): shows ProgressTop whenever any
 * React Query request is in flight. */
export function GlobalProgress() {
  const isFetching = useIsFetching();
  return <ProgressTop active={isFetching > 0} className="fixed" />;
}
