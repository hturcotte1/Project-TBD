import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default scale names, so it would read `text-14` as a text
 * color and drop it when merged with `text-fg`. Teach it the token scale from tokens.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['12', '14', '17', '22', '28', '34', '43', '54', '67', '84'],
      radius: ['lg'],
      shadow: ['float'],
      font: ['ui', 'count', 'mono'],
    },
  },
});

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
