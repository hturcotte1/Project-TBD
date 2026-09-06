'use client';

import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Segmented } from '@/components/system';
import type { AuthMode } from '@/lib/auth';
import { type ThemeSetting, useTheme } from '@/lib/theme';

export interface StudentMenuProps {
  trigger: ReactNode;
  isAdmin: boolean;
  authMode: AuthMode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

/** Profile, Settings, Admin (when admin), the theme control, Sign out — shared by the rail's
 * bottom row and the mobile header's avatar, so both open the exact same menu. */
export function StudentMenu({ trigger, isAdmin, authMode, side = 'top', align = 'start' }: StudentMenuProps) {
  const router = useRouter();
  const [theme, setTheme] = useTheme();

  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent side={side} align={align}>
        <MenuItem onSelect={() => router.push('/profile')}>Profile</MenuItem>
        <MenuItem onSelect={() => router.push('/settings')}>Settings</MenuItem>
        {isAdmin ? <MenuItem onSelect={() => router.push('/admin')}>Admin</MenuItem> : null}
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <div className="px-2 pb-2">
          <Segmented
            aria-label="Theme"
            value={theme}
            onValueChange={(value) => setTheme(value as ThemeSetting)}
            className="w-full"
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        </div>
        <MenuSeparator />
        <SignOutItem authMode={authMode} />
      </MenuContent>
    </Menu>
  );
}

function SignOutItem({ authMode }: { authMode: AuthMode }) {
  return authMode === 'clerk' ? <ClerkSignOutItem /> : <DevSignOutItem />;
}

function DevSignOutItem() {
  return (
    <MenuItem
      onSelect={() => {
        window.location.href = '/dev/logout';
      }}
    >
      Sign out
    </MenuItem>
  );
}

/** Only ever mounted when `authMode === 'clerk'`, at which point the root layout has already
 * wrapped the app in `ClerkProvider` — so `useClerk()` is always safe here (same pattern as
 * components/settings/danger-zone.tsx). */
function ClerkSignOutItem() {
  const { signOut } = useClerk();
  return <MenuItem onSelect={() => void signOut({ redirectUrl: '/sign-in' })}>Sign out</MenuItem>;
}
