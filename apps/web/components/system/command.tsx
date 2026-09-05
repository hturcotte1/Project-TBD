'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Command as CommandPrimitive } from 'cmdk';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { Kbd } from './kbd';
import { cn } from '@/lib/utils';

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Accessible name for the palette; there's no visible heading, so this stays screen-reader-only. */
  label?: string;
}

/** ⌘K/Ctrl-K anywhere: schools, essays, recommenders, next actions, pages and the page's own
 * actions, all in one search. A Dialog (focus trap, Escape) around cmdk (the fuzzy list). */
export function CommandDialog({ open, onOpenChange, children, label = 'Command palette' }: CommandDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-page/70 animate-fade-in" />
        {/* A horizontally-centering wrapper, not a translate transform on Content — see the same
            comment in dialog.tsx for why that would fight animate-slide-in-up's own transform. */}
        <div className="fixed inset-x-0 top-[10vh] z-50 flex justify-center px-4">
          <DialogPrimitive.Content className="w-full max-w-lg overflow-hidden rounded-lg bg-s3 shadow-float animate-slide-in-up">
            <VisuallyHidden asChild>
              <DialogPrimitive.Title>{label}</DialogPrimitive.Title>
            </VisuallyHidden>
            <VisuallyHidden asChild>
              <DialogPrimitive.Description>Search schools, essays, recommenders, next actions and pages.</DialogPrimitive.Description>
            </VisuallyHidden>
            <CommandPrimitive className="flex flex-col">{children}</CommandPrimitive>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = forwardRef<ElementRef<typeof CommandPrimitive.Input>, ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(
  function CommandInput({ className, ...props }, ref) {
    return (
      <div className="flex items-center gap-2 px-4">
        <MagnifyingGlass className="shrink-0 text-fg-3" />
        <CommandPrimitive.Input
          ref={ref}
          className={cn('h-12 w-full bg-transparent text-14 text-fg placeholder:text-fg-3', className)}
          {...props}
        />
      </div>
    );
  },
);

export const CommandList = forwardRef<ElementRef<typeof CommandPrimitive.List>, ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  function CommandList({ className, ...props }, ref) {
    return <CommandPrimitive.List ref={ref} className={cn('max-h-[360px] overflow-y-auto p-1', className)} {...props} />;
  },
);

export const CommandGroup = forwardRef<ElementRef<typeof CommandPrimitive.Group>, ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(
  function CommandGroup({ className, ...props }, ref) {
    return (
      <CommandPrimitive.Group
        ref={ref}
        className={cn(
          '[&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-12 [&_[cmdk-group-heading]]:text-fg-2',
          className,
        )}
        {...props}
      />
    );
  },
);

export interface CommandItemProps extends ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  /** A keyboard shortcut shown at the right of the row (rendered with Kbd). */
  shortcut?: string;
}

export const CommandItem = forwardRef<ElementRef<typeof CommandPrimitive.Item>, CommandItemProps>(function CommandItem(
  { className, children, shortcut, ...props },
  ref,
) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center justify-between gap-2 rounded px-2 text-14 text-fg data-[selected=true]:bg-s2',
        className,
      )}
      {...props}
    >
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <Kbd>{shortcut}</Kbd> : null}
    </CommandPrimitive.Item>
  );
});

export const CommandEmpty = forwardRef<ElementRef<typeof CommandPrimitive.Empty>, ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(
  function CommandEmpty({ className, ...props }, ref) {
    return <CommandPrimitive.Empty ref={ref} className={cn('px-4 py-6 text-center text-14 text-fg-2', className)} {...props} />;
  },
);
