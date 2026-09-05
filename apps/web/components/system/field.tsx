'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { cloneElement, isValidElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Describable = { id?: string; 'aria-describedby'?: string };

export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** A single form control (Input, Textarea, Select trigger, …) that accepts `id`. */
  children: ReactElement<Describable>;
  className?: string;
}

/** Labels one control and wires it to its help/error text via aria-describedby — the id is
 * generated here so callers never have to invent or collide on one. */
export function Field({ label, help, error, children, className }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children) ? cloneElement(children, { id, 'aria-describedby': describedBy }) : children;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <LabelPrimitive.Root htmlFor={id} className="text-14 font-medium text-fg">
        {label}
      </LabelPrimitive.Root>
      {control}
      {help ? (
        <p id={helpId} className="text-12 text-fg-2">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-12 text-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}
