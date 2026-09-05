'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cn } from '@/lib/utils';

// 32x18 is a fixed instrument size DESIGN.md calls out explicitly, not a spacing-scale value, so
// the track and thumb dimensions are the one place this file writes literal pixels.
export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  function Switch({ className, ...props }, ref) {
    return (
      <SwitchPrimitive.Root
        ref={ref}
        className={cn('relative h-[18px] w-8 shrink-0 rounded-full bg-s2 data-[state=checked]:bg-brand', className)}
        {...props}
      >
        {/* fg-3 (unchecked) and fg-on-brand (checked) are each the token designed to sit on the
            surface behind them; a single fixed thumb color would go invisible in one theme. */}
        <SwitchPrimitive.Thumb className="block h-[14px] w-[14px] translate-x-0.5 rounded-full bg-fg-3 data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-fg-on-brand" />
      </SwitchPrimitive.Root>
    );
  },
);
