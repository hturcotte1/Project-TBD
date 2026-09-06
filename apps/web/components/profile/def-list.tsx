import type { ReactNode } from 'react';

/** One label/value row of a section's read view. `value` renders in `text-fg`; a falsy value (or
 * an empty array/string) reads as "Not set" in `text-fg-3` instead. */
export function DefRow({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  return (
    <div className="flex gap-4 py-1 text-14">
      <span className="w-[160px] shrink-0 text-fg-2">{label}</span>
      {isEmpty ? <span className="text-fg-3">Not set</span> : <span className="text-fg">{value}</span>}
    </div>
  );
}

/** "A, B and C" for a short list of free-text tags (majors, courses, geography). */
export function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
