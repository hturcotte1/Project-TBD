'use client';

// Phosphor's icon components read IconContext via useContext, which only works in a Client
// Component — so any file that renders one, even a hookless one like this, needs the directive.
import { Check } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Quiet success: a check and a sentence, nothing that moves or celebrates. */
export function OkNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-14 text-ok', className)}>
      <Check />
      {children}
    </p>
  );
}

/** A plain sentence next to the thing that failed — no banner, no icon. */
export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn('text-14 text-err', className)}>
      {children}
    </p>
  );
}
