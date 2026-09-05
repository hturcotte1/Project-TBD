import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageTitleProps {
  children: ReactNode;
  /** Rendered to the right of the title (a date, a status sentence). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageTitle({ children, meta, actions, className }: PageTitleProps) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2', className)}>
      <h1 className="text-22 font-semibold lg:text-28">{children}</h1>
      <div className="flex items-center gap-4">
        {meta ? <span className="text-14 text-fg-2">{meta}</span> : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export interface SectionProps {
  title: ReactNode;
  /** A right-aligned slot next to the section title (a link, a filter). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, aside, children, className }: SectionProps) {
  // Plain block flow, not flex-col: flex's cross-axis stretch would force a bare trigger button
  // (a Dialog/Popover/Menu root renders no element of its own) to the section's full width and
  // read as centered, while removing stretch entirely breaks any child that relies on the normal
  // block default of filling its parent (e.g. a w-full bar inside a max-w-md wrapper). Ordinary
  // block children don't have that conflict: a button sizes to its content, a div to its parent.
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-17 font-semibold">{title}</h2>
        {aside ? <div className="text-14 text-fg-2">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Vertical rhythm between a page's sections — 32px, per DESIGN.md's spacing scale. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-8', className)}>{children}</div>;
}

/** Long-form body copy: capped at the measure width, paragraphs spaced by 12px. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('max-w-measure space-y-3 text-14 text-fg', className)}>{children}</div>;
}
