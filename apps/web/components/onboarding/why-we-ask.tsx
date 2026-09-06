import type { ReactNode } from 'react';

/**
 * Exactly one line, no icon, no toggle — the spec's single sentence of "why we ask this" under a
 * question's control. `interview-chat.tsx` and other steps that already have too much on screen
 * for one more line simply omit it.
 */
export function WhyWeAsk({ children }: { children: ReactNode }) {
  return <p className="text-12 text-fg-3">Why we ask — {children}</p>;
}
