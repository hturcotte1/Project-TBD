import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** An inline keyboard hint ("j and k to move"). font-ui because these are words, not identifiers
 * — a literal keycap glyph would call for font-mono, but "j" and "k" here are just short words. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-block min-w-[18px] rounded bg-s2 px-1 text-center font-ui text-12 text-fg-2', className)}>{children}</kbd>;
}
