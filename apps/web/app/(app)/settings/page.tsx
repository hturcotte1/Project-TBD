import { SettingsView } from '@/components/settings/settings-view';
import { AUTH_MODE } from '@/lib/auth';

/**
 * `AUTH_MODE` is a server-only env var (not `NEXT_PUBLIC_*`), so it has to be read here, on the
 * server, and handed down as a prop — the same pattern `(app)/layout.tsx` uses for `AppShell`.
 */
export default function SettingsPage() {
  return <SettingsView authMode={AUTH_MODE} />;
}
