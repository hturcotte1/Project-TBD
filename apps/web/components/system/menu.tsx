'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Menu = DropdownMenuPrimitive.Root;
export const MenuTrigger = DropdownMenuPrimitive.Trigger;

export const MenuContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Content>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  function MenuContent({ className, sideOffset = 4, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn('z-50 min-w-[180px] rounded-lg bg-s3 p-1 shadow-float', className)}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    );
  },
);

export interface MenuItemProps extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  /** A destructive action (remove, delete, sign out of everything) — text-err, still just text. */
  danger?: boolean;
}

export const MenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, MenuItemProps>(function MenuItem(
  { className, danger, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-8 cursor-pointer select-none items-center rounded px-2 text-14 data-[highlighted]:bg-s2',
        danger ? 'text-err' : 'text-fg',
        className,
      )}
      {...props}
    />
  );
});

export const MenuSeparator = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Separator>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(
  function MenuSeparator({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.Separator ref={ref} className={cn('my-1 border-b border-line', className)} {...props} />;
  },
);

export const MenuLabel = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Label>, ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>>(
  function MenuLabel({ className, ...props }, ref) {
    return <DropdownMenuPrimitive.Label ref={ref} className={cn('px-2 py-1 text-12 text-fg-2', className)} {...props} />;
  },
);
