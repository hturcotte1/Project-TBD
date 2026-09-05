'use client';

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption {
  value: string;
  label: ReactNode;
}

export interface SegmentedProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedOption[];
  'aria-label': string;
  className?: string;
}

/** A single-choice control for filters and the theme setting — a track of options, not tabs. */
export function Segmented({ value, onValueChange, options, className, ...props }: SegmentedProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix emits '' when the active item is clicked again; a segmented control always has
      // exactly one value selected, so an empty next value is ignored rather than clearing it.
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      className={cn('inline-flex h-8 items-center gap-0.5 rounded bg-s1 p-0.5', className)}
      {...props}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="flex h-full items-center rounded px-3 text-14 text-fg-2 data-[state=on]:bg-s2 data-[state=on]:text-fg"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
