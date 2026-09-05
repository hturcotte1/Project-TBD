'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** Mount once near the root, next to IconProvider. 300ms matches DESIGN.md's "quiet" chrome — a
 * tooltip that fires on every incidental hover would be noise. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>;
}

export const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(
  function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
    return (
      <TooltipPrimitive.Portal>
        {/* Floating surfaces never carry tertiary text (DESIGN.md contrast rule), so this is fg-2. */}
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn('z-50 rounded bg-s3 px-2 py-1 text-12 text-fg-2 shadow-float', className)}
          {...props}
        />
      </TooltipPrimitive.Portal>
    );
  },
);
