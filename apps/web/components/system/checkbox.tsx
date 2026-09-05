'use client';

import { Check } from '@phosphor-icons/react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong bg-s2 data-[state=checked]:border-brand data-[state=checked]:bg-brand',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex text-fg-on-brand">
          <Check />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
