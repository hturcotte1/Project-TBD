'use client';

import { CostsTab } from '@/components/admin/costs-tab';
import { DriftTab } from '@/components/admin/drift-tab';
import { JobsTab } from '@/components/admin/jobs-tab';
import { QueuesTab } from '@/components/admin/queues-tab';
import { StudentsTab } from '@/components/admin/students-tab';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminView() {
  return (
    <div className="pb-8">
      <PageHeader title="Admin" description="Operational view across every student." />
      <div className="px-4 py-5 sm:px-6">
        <Tabs defaultValue="students">
          <TabsList className="mb-4 h-auto flex-wrap">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="queues">Queues</TabsTrigger>
            <TabsTrigger value="jobs">Failed jobs</TabsTrigger>
            <TabsTrigger value="drift">Site drift</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>
          <TabsContent value="students">
            <StudentsTab />
          </TabsContent>
          <TabsContent value="queues">
            <QueuesTab />
          </TabsContent>
          <TabsContent value="jobs">
            <JobsTab />
          </TabsContent>
          <TabsContent value="drift">
            <DriftTab />
          </TabsContent>
          <TabsContent value="costs">
            <CostsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
