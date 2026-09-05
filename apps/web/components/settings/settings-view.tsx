'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CommonAppCard } from '@/components/settings/common-app-card';
import { DangerZone } from '@/components/settings/danger-zone';
import { DataExportSection } from '@/components/settings/data-export-section';
import { GmailCard } from '@/components/settings/gmail-card';
import { ImessageCard } from '@/components/settings/imessage-card';
import { NotificationsForm } from '@/components/settings/notifications-form';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';
import type { AuthMode } from '@/lib/auth';

export function SettingsView({ authMode }: { authMode: AuthMode }) {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => clientApi.call('settingsGet') });
  const syncStatusQuery = useQuery({ queryKey: ['sync-status'], queryFn: () => clientApi.call('syncStatus'), refetchInterval: 5000 });

  const settings = settingsQuery.data;
  const commonAppCredential = settings?.connected_accounts.find((account) => account.provider === 'common_app');

  return (
    <div className="pb-8">
      <PageHeader title="Settings" description="How Vector reaches you, what it's connected to, and your data." />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {!settings || settingsQuery.isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : settingsQuery.isError ? (
          <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load settings — try refreshing.</p>
        ) : (
          <>
            <NotificationsForm settings={settings} />

            <div className="space-y-1.5 pt-2">
              <h2 className="text-sm font-medium text-muted-foreground">Connected accounts</h2>
            </div>
            {commonAppCredential ? <CommonAppCard credential={commonAppCredential} syncStatus={syncStatusQuery.data} /> : null}
            <ImessageCard agentName={settings.agent_name} agentPhone={settings.agent_phone_number} />
            <GmailCard enabled={settings.features.gmail} />

            <DataExportSection />
            <DangerZone authMode={authMode} />

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/privacy" className="underline underline-offset-2">
                Read the privacy page
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
