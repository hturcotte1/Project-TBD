'use client';

import { CaretDown, CaretUp } from '@phosphor-icons/react';
import type { HTMLAttributes, KeyboardEvent, MouseEvent, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  // The separate border model (not border-collapse) is what makes TableHead's border-b actually
  // render across browsers — collapsed tables only paint borders declared on cells, not on thead.
  return <table className={cn('w-full border-separate border-spacing-0 text-14 text-fg', className)} {...props} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-line', className)} {...props} />;
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sort?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

/** A header cell, optionally sortable. The caret only appears once a sort direction is active —
 * an unsorted column stays plain text, never an idle arrow glyph. */
export function TableHeaderCell({ className, sort, onSort, children, ...props }: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
      className={cn('h-8 px-3 text-left align-middle', className)}
      {...props}
    >
      {onSort ? (
        <button type="button" onClick={onSort} className="inline-flex items-center gap-1 text-12 font-normal text-fg-2">
          {children}
          {sort === 'asc' ? <CaretUp /> : sort === 'desc' ? <CaretDown /> : null}
        </button>
      ) : (
        <span className="inline-flex items-center text-12 font-normal text-fg-2">{children}</span>
      )}
    </th>
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Hover lift, pointer cursor, keyboard-focusable, Enter/Space fires onClick. */
  interactive?: boolean;
  selected?: boolean;
  expanded?: boolean;
}

export function TableRow({ className, interactive = false, selected = false, expanded, onClick, onKeyDown, ...props }: TableRowProps) {
  return (
    <tr
      className={cn('h-row-touch lg:h-row', interactive && 'cursor-pointer hover:bg-s2 focus-inset', selected && 'bg-s2', className)}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
        if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          // A key press has no click coordinates; the row's onClick only ever reads target/
          // currentTarget, so re-using the keyboard event under the click event's type is safe.
          onClick(event as unknown as MouseEvent<HTMLTableRowElement>);
        }
        onKeyDown?.(event);
      }}
      {...props}
    />
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  muted?: boolean;
}

export function TableCell({ className, numeric = false, muted = false, ...props }: TableCellProps) {
  return <td className={cn('px-3 text-14', numeric && 'text-right tabular-nums', muted && 'text-fg-2', className)} {...props} />;
}

export interface TableExpansionProps extends HTMLAttributes<HTMLTableCellElement> {
  colSpan: number;
}

/** A full-width row of inline detail under an opened row (evidence, sub-items) — its own row, not
 * a nested card, so the table stays a stack of rows. */
export function TableExpansion({ colSpan, className, children, ...props }: TableExpansionProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('animate-fade-in bg-s1 px-4 py-3', className)} {...props}>
        {children}
      </td>
    </tr>
  );
}
