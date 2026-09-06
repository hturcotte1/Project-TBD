'use client';

import { MagnifyingGlass, SidebarSimple } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Button, Kbd, Tooltip, TooltipContent, TooltipTrigger } from '@/components/system';
import type { AuthMode } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { isMacPlatform } from './keyboard';
import { buildPrimaryNav, isNavActive } from './nav-items';
import { StudentMenu } from './student-menu';
import { useRailCollapsed } from './use-rail-collapsed';

export interface RailProps {
  studentName: string;
  isAdmin: boolean;
  authMode: AuthMode;
  agentName: string;
  onOpenPalette: () => void;
}

/** The desktop (lg and up) left rail: wordmark + collapse, the seven-item nav, the search row
 * that opens the palette, and the student's name opening the account menu. Collapses to icons
 * only, persisted in localStorage. */
export function Rail({ studentName, isAdmin, authMode, agentName, onOpenPalette }: RailProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useRailCollapsed();
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(isMacPlatform()), []);

  const items = buildPrimaryNav(agentName);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-s1 lg:flex',
        collapsed ? 'w-rail-collapsed' : 'w-rail',
      )}
    >
      <div className={cn('flex items-center px-2', collapsed ? 'h-auto flex-col gap-2 py-3' : 'h-row justify-between')}>
        <span className="px-2 text-17 font-semibold text-fg">{collapsed ? 'A' : 'Apogee'}</span>
        <Button variant="quiet" size="sm" iconOnly aria-label="Collapse navigation" onClick={() => setCollapsed(!collapsed)}>
          <SidebarSimple size={20} />
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {items.map((item) => {
          const active = isNavActive(item.href, pathname);
          const link = (
            <Link
              href={item.href}
              className={cn(
                'flex h-row items-center gap-3 rounded px-2 text-14',
                collapsed && 'justify-center px-0',
                active ? 'bg-brand-soft font-medium text-brand' : 'text-fg-2 hover:text-fg',
              )}
            >
              <item.icon size={20} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
          if (!collapsed) return <div key={item.href}>{link}</div>;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="px-2 py-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenPalette}
                aria-label="Search"
                className="flex h-row w-full items-center justify-center rounded text-fg-2 hover:text-fg"
              >
                <MagnifyingGlass size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Search</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex h-row w-full items-center gap-3 rounded px-2 text-14 text-fg-2 hover:text-fg"
          >
            <MagnifyingGlass size={20} />
            <span className="flex-1 text-left">Search</span>
            <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
          </button>
        )}
      </div>

      <div className="px-2 pb-2">
        <StudentMenu
          isAdmin={isAdmin}
          authMode={authMode}
          side={collapsed ? 'right' : 'top'}
          trigger={
            <button
              type="button"
              aria-label={`Account menu for ${studentName}`}
              className={cn(
                'flex h-row w-full items-center gap-3 rounded px-2 text-14 text-fg hover:bg-s2',
                collapsed && 'justify-center px-0',
              )}
            >
              <Avatar name={studentName} size={24} />
              {!collapsed ? <span className="truncate">{studentName}</span> : null}
            </button>
          }
        />
      </div>
    </aside>
  );
}
