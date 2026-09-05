'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef<ElementRef<typeof PopoverPrimitive.Content>, ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(
  function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }, ref) {
    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn('z-50 w-72 rounded-lg bg-s3 p-3 text-14 text-fg shadow-float', className)}
          {...props}
        />
      </PopoverPrimitive.Portal>
    );
  },
);
