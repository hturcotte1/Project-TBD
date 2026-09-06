'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MOBILE_TAB_HREFS, buildPrimaryNav, isNavActive } from './nav-items';

export interface MobileTabBarProps {
  agentName: string;
  onOpenPalette: () => void;
}

/** Below lg: Today, Schools, Essays, the conversation, and Search (which opens the palette).
 * Recommenders, Timeline and Activity are reached from the palette and from links elsewhere. */
export function MobileTabBar({ agentName, onOpenPalette }: MobileTabBarProps) {
  const pathname = usePathname();
  const items = buildPrimaryNav(agentName).filter((item) => MOBILE_TAB_HREFS.includes(item.href));

  return (
    <nav className="safe-bottom sticky bottom-0 z-40 flex h-tabbar shrink-0 border-t border-line bg-s1 lg:hidden">
      {items.map((item) => {
        const active = isNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-12', active ? 'text-brand' : 'text-fg-2')}
          >
            <item.icon size={20} />
            {item.label}
          </Link>
        );
      })}
      <button type="button" onClick={onOpenPalette} className="flex flex-1 flex-col items-center justify-center gap-1 text-12 text-fg-2">
        <MagnifyingGlass size={20} />
        Search
      </button>
    </nav>
  );
}
