'use client';

import { useQuery } from '@tanstack/react-query';
import { AllActivityTab } from '@/components/activity/all-tab';
import { ChangesTab } from '@/components/activity/changes-tab';
import { AgentRunsTab } from '@/components/activity/runs-tab';
import { SyncsTab } from '@/components/activity/syncs-tab';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientApi } from '@/lib/api.client';

export default function ActivityPage() {
  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  return (
    <div className="pb-8">
      <PageHeader title="Activity" description="Everything the agent did and saw, in order." />
      <div className="px-4 py-5 sm:px-6">
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="syncs">Syncs</TabsTrigger>
            <TabsTrigger value="runs">Agent runs</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <AllActivityTab />
          </TabsContent>
          <TabsContent value="syncs">
            <SyncsTab />
          </TabsContent>
          <TabsContent value="runs">
            <AgentRunsTab />
          </TabsContent>
          <TabsContent value="changes">
            <ChangesTab timezone={timezone} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
