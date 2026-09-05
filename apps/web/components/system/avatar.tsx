import { cn } from '@/lib/utils';

export type AvatarSize = 24 | 32;

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  24: 'h-6 w-6',
  32: 'h-8 w-8',
};

/** First letter of the first and last word ("Dee Demo" -> "DD"); a single word keeps its first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '';
  const last = parts[parts.length - 1];
  if (!last || last === first) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export function Avatar({ name, size = 24, className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-s2 text-12 font-medium text-fg-2', SIZE_CLASSES[size], className)}
    >
      {initials(name)}
    </span>
  );
}
