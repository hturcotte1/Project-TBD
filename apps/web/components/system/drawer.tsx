'use client';

import { X } from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// A drawer is a Dialog with a different shape, not a different primitive — same focus trap,
// same Escape-to-close, same portal.
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const DrawerOverlay = forwardRef<ElementRef<typeof DialogPrimitive.Overlay>, ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  function DrawerOverlay({ className, ...props }, ref) {
    return <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-page/70 animate-fade-in', className)} {...props} />;
  },
);

export const DrawerContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  function DrawerContent({ className, children, ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DrawerOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            // Below lg: a bottom sheet that slides up. At lg and up: a right panel that slides in
            // from the edge. Tailwind's mobile-first cascade lets the lg: rules simply win at width.
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-lg bg-s3 shadow-float animate-slide-in-up',
            'lg:inset-y-0 lg:bottom-auto lg:left-auto lg:right-0 lg:h-full lg:max-h-none lg:w-full lg:max-w-[420px] lg:rounded-t-none lg:animate-slide-in-right',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close aria-label="Close" className="absolute right-4 top-4 flex text-fg-2 hover:text-fg">
            <X />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

export const DrawerTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  function DrawerTitle({ className, ...props }, ref) {
    return <DialogPrimitive.Title ref={ref} className={cn('px-6 pr-12 pt-6 text-22 font-semibold text-fg', className)} {...props} />;
  },
);

/** The scrolling middle of the drawer, between the fixed title and footer. */
export function DrawerBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 px-6 py-4', className)} {...props} />;
}
