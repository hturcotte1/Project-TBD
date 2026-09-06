'use client';

import type { ActivityDto } from '@apogee/shared/api';
import type { ActivityInput } from '@apogee/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivitiesEditor } from '@/components/profile/activities-editor';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { Button, Drawer, DrawerTrigger, Empty, Section, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

function stripIds(activities: ActivityDto[]): ActivityInput[] {
  return activities.map(({ id: _id, order: _order, ...rest }) => rest);
}

function hoursSentence(activity: ActivityInput): string {
  if (activity.hours_per_week <= 0) return activity.position;
  const hours = `${activity.hours_per_week} hour${activity.hours_per_week === 1 ? '' : 's'} a week`;
  return activity.position ? `${activity.position}, ${hours}` : hours;
}

export function ActivitiesSection({ activities }: { activities: ActivityDto[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ActivityInput[]>(stripIds(activities));

  const save = useMutation({
    mutationFn: () => clientApi.call('activitiesReplace', { body: { activities: local } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Activities"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setLocal(stripIds(activities));
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Activities" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <ActivitiesEditor activities={local} onChange={setLocal} />
          </DrawerContentShell>
        </Drawer>
      }
    >
      {activities.length === 0 ? (
        <Empty sentence="No activities yet." action={{ label: 'Add an activity', onClick: () => setOpen(true) }} />
      ) : (
        <div className="flex flex-col gap-2">
          {activities.map((activity) => (
            <div key={activity.id}>
              <p className="font-medium text-fg">{activity.organization || 'Untitled activity'}</p>
              <p className="text-14 text-fg-2">{hoursSentence(activity)}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
