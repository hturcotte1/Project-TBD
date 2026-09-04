'use client';

import type { ActivityDto } from '@tbd/shared/api';
import type { ActivityInput } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivitiesEditor } from '@/components/onboarding/activities-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

function stripIds(activities: ActivityDto[]): ActivityInput[] {
  return activities.map(({ id: _id, order: _order, ...rest }) => rest);
}

export function ActivitiesSection({ activities }: { activities: ActivityDto[] }) {
  const { toast } = useToast();
  const [local, setLocal] = useState<ActivityInput[]>(stripIds(activities));

  const save = useMutation({
    mutationFn: () => clientApi.call('activitiesReplace', { body: { activities: local } }),
    onSuccess: (updated) => {
      setLocal(stripIds(updated));
      toast({ title: 'Activities saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activities</CardTitle>
        <CardDescription>The same list Common App sees — up to 10, in the order you want them ranked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActivitiesEditor activities={local} onChange={setLocal} />
        <div className="flex justify-end">
          <Button type="button" onClick={() => save.mutate()} loading={save.isPending}>
            Save activities
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
