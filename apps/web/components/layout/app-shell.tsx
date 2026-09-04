'use client';

import { Activity as ActivityIcon, Calendar, FileText, Home, LogOut, Menu, School, Settings, ShieldCheck, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ComponentType } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AuthMode } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/schools', label: 'Schools', icon: School },
  { href: '/timeline', label: 'Timeline', icon: Calendar },
  { href: '/essays', label: 'Essays', icon: FileText },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/recommenders', label: 'Recs', icon: Users },
  { href: '/activity', label: 'Activity', icon: ActivityIcon },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const ADMIN_NAV: NavItem = { href: '/admin', label: 'Admin', icon: ShieldCheck };

export interface AppShellProps {
  children: React.ReactNode;
  studentName: string;
  isAdmin: boolean;
  authMode: AuthMode;
  agentName: string;
}

export function AppShell({ children, studentName, isAdmin, authMode, agentName }: AppShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const sidebarNav = isAdmin ? [...PRIMARY_NAV, ...SECONDARY_NAV, ADMIN_NAV] : [...PRIMARY_NAV, ...SECONDARY_NAV];
  const overflowNav = isAdmin ? [...SECONDARY_NAV, ADMIN_NAV] : SECONDARY_NAV;

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {agentName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{agentName}</p>
            <p className="truncate text-xs text-muted-foreground">for {studentName}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {sidebarNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        {authMode === 'dev' ? (
          <div className="border-t border-border px-3 py-3">
            <a
              href="/dev/logout"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" /> Log out
            </a>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive(item.href) ? 'text-primary' : 'text-muted-foreground')}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium',
            overflowNav.some((item) => isActive(item.href)) ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            {overflowNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                  isActive(item.href) ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            {authMode === 'dev' ? (
              <a href="/dev/logout" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
                <LogOut className="h-4 w-4" /> Log out
              </a>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
