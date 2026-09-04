'use client';

import type { NarrativeDto } from '@tbd/shared/api';
import type { StudentNarrative } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/layout/empty-state';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function NarrativeSection({ narrative }: { narrative: NarrativeDto | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [local, setLocal] = useState<StudentNarrative | null>(narrative?.narrative ?? null);

  const save = useMutation({
    mutationFn: () => {
      if (!local) throw new Error('no narrative');
      return clientApi.call('narrativeUpdate', { body: local });
    },
    onSuccess: (updated) => {
      setLocal(updated.narrative);
      toast({ title: 'Your story is saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  const restart = useMutation({
    mutationFn: () => clientApi.call('narrativeRestartInterview'),
    onSuccess: () => router.push('/profile/interview'),
    onError: () => toast({ title: 'Could not start over — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Your story</CardTitle>
          <CardDescription>What the agent draws on so essays and short answers sound like you, not it.</CardDescription>
        </div>
        {local ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => restart.mutate()} loading={restart.isPending}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-run the interview
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {local ? (
          <>
            <NarrativeReview narrative={local} onChange={setLocal} />
            <div className="flex justify-end">
              <Button type="button" onClick={() => save.mutate()} loading={save.isPending}>
                Save your story
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No story on file yet"
            description="A short conversation with the agent builds this — themes, stories, and how you talk — so later drafts and feedback sound like you."
            action={
              <Button type="button" onClick={() => router.push('/profile/interview')}>
                Start the interview
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
