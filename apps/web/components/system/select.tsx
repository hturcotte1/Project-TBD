'use client';

import { CaretDown, Check } from '@phosphor-icons/react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(
  function SelectTrigger({ className, children, ...props }, ref) {
    return (
      // Same skin as Input, so a select reads as one of the same family of controls.
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded border border-line-strong bg-s2 px-3 text-14 text-fg data-[placeholder]:text-fg-3',
          className,
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <CaretDown className="shrink-0 text-fg-3" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);

export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  function SelectContent({ className, children, position = 'popper', ...props }, ref) {
    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          position={position}
          sideOffset={4}
          className={cn('z-50 overflow-hidden rounded-lg bg-s3 p-1 shadow-float', className)}
          {...props}
        >
          <SelectPrimitive.Viewport
            className={cn('max-h-[300px] overflow-y-auto', position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}
          >
            {children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);

export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(
  function SelectItem({ className, children, ...props }, ref) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex h-8 w-full cursor-pointer select-none items-center rounded px-2 pr-7 text-14 text-fg data-[highlighted]:bg-s2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator className="absolute right-2 flex">
          <Check />
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    );
  },
);

export const SelectLabel = forwardRef<ElementRef<typeof SelectPrimitive.Label>, ComponentPropsWithoutRef<typeof SelectPrimitive.Label>>(
  function SelectLabel({ className, ...props }, ref) {
    return <SelectPrimitive.Label ref={ref} className={cn('px-2 py-1 text-12 text-fg-2', className)} {...props} />;
  },
);

export const SelectSeparator = forwardRef<ElementRef<typeof SelectPrimitive.Separator>, ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>>(
  function SelectSeparator({ className, ...props }, ref) {
    return <SelectPrimitive.Separator ref={ref} className={cn('my-1 h-px bg-line', className)} {...props} />;
  },
);
