'use client';

import type { NarrativeDto } from '@apogee/shared/api';
import type { StudentNarrative } from '@apogee/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NarrativeReview } from '@/components/onboarding/narrative-review';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { Button, Drawer, DrawerTrigger, Empty, Prose, Section, TextLink, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

export function NarrativeSection({ narrative }: { narrative: NarrativeDto | null }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<StudentNarrative | null>(narrative?.narrative ?? null);

  const save = useMutation({
    mutationFn: () => {
      if (!local) throw new Error('no narrative');
      return clientApi.call('narrativeUpdate', { body: local });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  const aside = narrative ? (
    <div className="flex items-center gap-4">
      <Drawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setLocal(narrative.narrative);
        }}
      >
        <DrawerTrigger asChild>
          <Button variant="text" className="h-auto px-0">
            Edit
          </Button>
        </DrawerTrigger>
        <DrawerContentShell title="Story" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
          {local ? <NarrativeReview narrative={local} onChange={setLocal} /> : null}
        </DrawerContentShell>
      </Drawer>
      <TextLink href="/profile/interview">Redo the interview</TextLink>
    </div>
  ) : null;

  return (
    <Section title="Story" aside={aside}>
      {narrative ? (
        <Prose>
          {narrative.narrative.summary ? <p>{narrative.narrative.summary}</p> : null}
          {narrative.narrative.themes.map((theme, index) => (
            <p key={index}>
              <span className="font-medium text-fg">{theme.title}. </span>
              {theme.description}
            </p>
          ))}
        </Prose>
      ) : (
        <Empty sentence="No story on file yet. A short conversation with Vector builds this." action={{ label: 'Start the interview', href: '/profile/interview' }} />
      )}
    </Section>
  );
}
