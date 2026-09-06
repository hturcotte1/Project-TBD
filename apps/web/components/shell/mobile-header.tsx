'use client';

import { Avatar } from '@/components/system';
import type { AuthMode } from '@/lib/auth';
import { StudentMenu } from './student-menu';

export interface MobileHeaderProps {
  studentName: string;
  isAdmin: boolean;
  authMode: AuthMode;
}

/** Below lg, each page renders its own PageTitle; this is only the account-menu row above it —
 * the wordmark left, the student's avatar right, opening the same menu the rail's does. */
export function MobileHeader({ studentName, isAdmin, authMode }: MobileHeaderProps) {
  return (
    <header className="flex h-row items-center justify-between px-4 lg:hidden">
      <span className="text-17 font-semibold text-fg">Apogee</span>
      <StudentMenu
        isAdmin={isAdmin}
        authMode={authMode}
        side="bottom"
        align="end"
        trigger={
          <button type="button" aria-label={`Account menu for ${studentName}`}>
            <Avatar name={studentName} size={24} />
          </button>
        }
      />
    </header>
  );
}
