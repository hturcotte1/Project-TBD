'use client';

import { Slot } from '@radix-ui/react-slot';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CircleNotch } from '@phosphor-icons/react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'text' | 'quiet' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'sm';

// Only `primary` carries a fill — DESIGN.md is explicit that there is one filled button per
// screen, everything else reads as text so the page doesn't compete with itself.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-fg-on-brand',
  text: 'text-fg hover:underline underline-offset-4',
  quiet: 'text-fg-2 hover:text-fg',
  danger: 'text-err hover:underline underline-offset-4',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'h-8 px-3 text-14',
  lg: 'h-10 px-4 text-14',
  sm: 'h-7 px-2 text-12',
};

const ICON_ONLY_SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  sm: 'h-7 w-7',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the single child as the interactive element (e.g. wrap a `next/link`) via Radix Slot. */
  asChild?: boolean;
  /** Swaps the label for a spinner and disables the button. */
  loading?: boolean;
  /** A square icon-only button. Requires `aria-label` — there is no other accessible name. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'text', size = 'md', asChild = false, loading = false, iconOnly = false, disabled, children, 'aria-label': ariaLabel, ...props },
  ref,
) {
  if (iconOnly && !ariaLabel) {
    // An icon with no visible text and no aria-label is a dead end for a screen reader. Fail
    // loudly in the render that creates it rather than shipping a button nobody can name.
    throw new Error('Button: iconOnly requires an aria-label');
  }

  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium disabled:cursor-not-allowed disabled:opacity-50',
        iconOnly ? cn(ICON_ONLY_SIZE_CLASSES[size], 'justify-center') : SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        !disabled && !loading && 'cursor-pointer',
        className,
      )}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <CircleNotch className="animate-spin" aria-hidden />
          <VisuallyHidden>Loading</VisuallyHidden>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
