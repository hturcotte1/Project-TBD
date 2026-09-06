/** Same guarded matchMedia check the system's Countdown and ProgressTop use — duplicated here
 * (rather than imported) because it lives in components/system, which is out of this area's
 * scope to add exports to. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
