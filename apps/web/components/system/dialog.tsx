'use client';

import { X } from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<ElementRef<typeof DialogPrimitive.Overlay>, ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  function DialogOverlay({ className, ...props }, ref) {
    return <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-page/70 animate-fade-in', className)} {...props} />;
  },
);

export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  function DialogContent({ className, children, ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogOverlay />
        {/* Centering lives on this wrapper via flexbox, not a translate transform on Content —
            animate-slide-in-up's keyframes set `transform` too, and the two would fight for the
            one transform property (the static translate wins once the animation ends, but the
            content sits off-center for the entire 200ms it's actually opening). */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              'relative flex w-full max-w-md flex-col gap-4 rounded-lg bg-s3 p-6 shadow-float animate-slide-in-up',
              className,
            )}
            {...props}
          >
            {children}
            <DialogPrimitive.Close aria-label="Close" className="absolute right-4 top-4 flex text-fg-2 hover:text-fg">
              <X />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    );
  },
);

export const DialogTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  function DialogTitle({ className, ...props }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cn('pr-6 text-22 font-semibold text-fg', className)} {...props} />;
  },
);

export const DialogDescription = forwardRef<ElementRef<typeof DialogPrimitive.Description>, ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  function DialogDescription({ className, ...props }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cn('text-14 text-fg-2', className)} {...props} />;
  },
);

/** Right-aligned action row — the last thing in a dialog's flex-col stack, so it stays full width. */
export function DialogActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2', className)} {...props} />;
}
