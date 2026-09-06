import { ApiError } from '@apogee/shared/api';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { serverApi } from '@/lib/api.server';
import { AUTH_MODE, loginPath, requireStudent } from '@/lib/auth';

async function loadShellData() {
  const api = serverApi();
  try {
    return await Promise.all([api.call('me'), api.call('settingsGet')]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(loginPath());
    throw error;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireStudent();
  const [student, settings] = await loadShellData();

  if (!student.onboarding_completed_at) redirect('/onboarding');

  return (
    <AppShell studentName={student.preferred_name || student.first_name} isAdmin={student.role === 'admin'} authMode={AUTH_MODE} agentName={settings.agent_name}>
      {children}
    </AppShell>
  );
}
