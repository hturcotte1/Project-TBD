'use client';

import { X } from '@phosphor-icons/react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastRecord {
  id: string;
  text: string;
  action?: ToastAction;
}

// A tiny module-level store: `toast()` can be called from anywhere (event handlers, query
// callbacks, non-component code) and every mounted <Toaster /> re-renders on each change.
type Listener = (toasts: ToastRecord[]) => void;
let toasts: ToastRecord[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit() {
  for (const listener of listeners) listener(toasts);
}

function dismiss(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

/** Queues one toast: a plain sentence, optionally with a single text action. Returns its id. */
export function toast(text: string, opts?: { action?: ToastAction }): string {
  const id = `toast-${++seq}`;
  toasts = [...toasts, { id, text, action: opts?.action }];
  emit();
  return id;
}

export function useToast() {
  const [state, setState] = useState<ToastRecord[]>(toasts);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { toasts: state, dismiss };
}

const AUTO_DISMISS_MS = 5000;

/** Mount once near the root. Bottom-right on desktop, top on mobile (out of thumb's way of the
 * bottom tab bar). */
export function Toaster() {
  const { toasts: items } = useToast();

  return (
    <ToastPrimitive.Provider duration={AUTO_DISMISS_MS}>
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          role="status"
          className={cn(
            'flex w-full max-w-sm items-center justify-between gap-3 rounded-lg bg-s3 px-4 py-3 text-14 text-fg shadow-float',
            'data-[state=open]:animate-slide-in-up',
          )}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
        >
          <ToastPrimitive.Description className="flex-1">{item.text}</ToastPrimitive.Description>
          {item.action ? (
            <ToastPrimitive.Action asChild altText={item.action.label}>
              <button type="button" onClick={item.action.onClick} className="shrink-0 text-brand hover:underline underline-offset-4">
                {item.action.label}
              </button>
            </ToastPrimitive.Action>
          ) : null}
          <ToastPrimitive.Close aria-label="Dismiss" className="flex shrink-0 text-fg-2 hover:text-fg">
            <X />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 p-4 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-auto lg:items-end" />
    </ToastPrimitive.Provider>
  );
}
