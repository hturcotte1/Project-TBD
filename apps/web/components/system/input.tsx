'use client';

import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { forwardRef, useRef, useState } from 'react';
import type { ChangeEvent, ForwardedRef, InputHTMLAttributes, MutableRefObject, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Keeps a local ref in sync with whatever ref (callback, object, or none) the caller passed. */
function mergeRefs<T>(local: MutableRefObject<T | null>, forwarded: ForwardedRef<T>) {
  return (node: T | null) => {
    local.current = node;
    if (typeof forwarded === 'function') forwarded(node);
    else if (forwarded) forwarded.current = node;
  };
}

export type InputSize = 'md' | 'lg';

const SIZE_CLASSES: Record<InputSize, string> = {
  md: 'h-8',
  lg: 'h-10',
};

/** Shared skin for every text-entry control (Input, Textarea, SearchInput's own markup). */
function fieldClasses(invalid: boolean, extra?: string): string {
  return cn(
    'w-full rounded border bg-s2 px-3 text-14 text-fg placeholder:text-fg-3 disabled:cursor-not-allowed disabled:opacity-50',
    invalid ? 'border-err' : 'border-line-strong',
    extra,
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  invalid?: boolean;
  /** An icon rendered inside the field, left-aligned (e.g. MagnifyingGlass for search). */
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, size = 'md', invalid = false, leading, ...props }, ref) {
  return (
    <div className="relative flex items-center">
      {leading ? <span className="pointer-events-none absolute left-3 flex text-fg-3">{leading}</span> : null}
      <input ref={ref} className={cn(fieldClasses(invalid, SIZE_CLASSES[size]), leading && 'pl-9', className)} aria-invalid={invalid || undefined} {...props} />
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Grows with content instead of scrolling; disables manual resize. */
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, autoResize = false, onInput, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      onInput={(event) => {
        if (autoResize) {
          const el = event.currentTarget;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }
        onInput?.(event);
      }}
      className={cn(fieldClasses(invalid, 'py-2'), autoResize ? 'resize-none overflow-hidden' : 'resize-y', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export interface SearchInputProps extends Omit<InputProps, 'leading'> {
  /** Called after the clear button empties the field (in addition to the resulting onChange). */
  onClear?: () => void;
}

/** An Input pre-wired for search: a MagnifyingGlass, and a clear button once there's text. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, value, defaultValue, onChange, onClear, size = 'md', invalid = false, ...props },
  ref,
) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ? String(defaultValue) : '');
  const current = isControlled ? String(value ?? '') : uncontrolled;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setUncontrolled(event.target.value);
    onChange?.(event);
  };

  const handleClear = () => {
    // An uncontrolled field just resets local state; a controlled one is the caller's value to
    // own, so onClear is where they clear it (we still refocus either way).
    if (!isControlled) setUncontrolled('');
    inputRef.current?.focus();
    onClear?.();
  };

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 flex text-fg-3">
        <MagnifyingGlass />
      </span>
      <input
        ref={mergeRefs(inputRef, ref)}
        type="search"
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        className={cn(fieldClasses(invalid, SIZE_CLASSES[size]), 'pl-9', current && 'pr-9', '[&::-webkit-search-cancel-button]:hidden', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {current ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="absolute right-2 flex text-fg-3 hover:text-fg"
        >
          <X />
        </button>
      ) : null}
    </div>
  );
});
