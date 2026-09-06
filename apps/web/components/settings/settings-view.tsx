'use client';

import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { AppearanceSection } from '@/components/settings/appearance-section';
import { CommonAppSection } from '@/components/settings/common-app-section';
import { DataExportSection } from '@/components/settings/data-export-section';
import { DeleteAccountSection } from '@/components/settings/delete-account-section';
import { GmailSection } from '@/components/settings/gmail-section';
import { ImessageSection } from '@/components/settings/imessage-section';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { Button, ErrorNote, PageTitle, Stack, TextLink } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import type { AuthMode } from '@/lib/auth';

export function SettingsView({ authMode }: { authMode: AuthMode }) {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => clientApi.call('settingsGet') });
  const syncStatusQuery = useQuery({ queryKey: ['sync-status'], queryFn: () => clientApi.call('syncStatus'), refetchInterval: 5000 });

  const settings = settingsQuery.data;
  const commonAppCredential = settings?.connected_accounts.find((account) => account.provider === 'common_app');

  return (
    <div className="flex flex-col gap-8">
      {/* DESIGN.md reserves the count face (Bricolage) for Today, school headers and the Schools
          table — Settings has no numeral of its own. A hidden span still warms the font file so
          it's not left completely unloaded (same warm-up Schools, Essays and Timeline do). */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <PageTitle>Settings</PageTitle>

      {settingsQuery.isError ? (
        <ErrorNote>
          Could not load settings.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => settingsQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : settings ? (
        <Stack>
          <NotificationsSection settings={settings} />
          <AppearanceSection />
          <CommonAppSection credential={commonAppCredential} syncStatus={syncStatusQuery.data} />
          <ImessageSection agentName={settings.agent_name} agentPhone={settings.agent_phone_number} />
          <GmailSection enabled={settings.features.gmail} />
          <DataExportSection />
          <DeleteAccountSection authMode={authMode} />
          <p className="text-12 text-fg-3">
            <TextLink href="/privacy">Privacy</TextLink>
          </p>
        </Stack>
      ) : null}
    </div>
  );
}
