import type { ReactNode } from 'react';

export function WhyWeAsk({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">Why we ask — </span>
      {children}
    </p>
  );
}
