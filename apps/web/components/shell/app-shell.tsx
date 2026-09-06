'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CommandPalette } from '@/components/palette/command-palette';
import { GlobalProgress } from '@/components/system';
import type { AuthMode } from '@/lib/auth';
import { MobileHeader } from './mobile-header';
import { MobileTabBar } from './mobile-tab-bar';
import { Rail } from './rail';

export interface AppShellProps {
  children: ReactNode;
  studentName: string;
  isAdmin: boolean;
  authMode: AuthMode;
  agentName: string;
}

/** The whole app frame: the desktop rail or the mobile header + tab bar, one content column, the
 * global loading bar, and the command palette wired to ⌘K/Ctrl-K everywhere. */
export function AppShell({ children, studentName, isAdmin, authMode, agentName }: AppShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    // ⌘K/Ctrl-K always works, even while a text field has focus — unlike the queue's bare-letter
    // shortcuts, a chord like this can't collide with normal typing.
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Rail studentName={studentName} isAdmin={isAdmin} authMode={authMode} agentName={agentName} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader studentName={studentName} isAdmin={isAdmin} authMode={authMode} />
        <main className="relative flex-1">
          <GlobalProgress />
          <div className="mx-auto max-w-content px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
        <MobileTabBar agentName={agentName} onOpenPalette={() => setPaletteOpen(true)} />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} isAdmin={isAdmin} agentName={agentName} />
    </div>
  );
}
