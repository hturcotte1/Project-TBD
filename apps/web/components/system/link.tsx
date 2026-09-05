import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** An inline link inside a sentence: brand-colored, underlines on hover and focus. */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn('text-brand underline-offset-4 hover:underline focus-visible:underline', className)} {...props} />;
}
