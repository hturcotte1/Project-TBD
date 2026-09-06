'use client';

import type { Academics } from '@apogee/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DefRow, joinList } from '@/components/profile/def-list';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { TagInput } from '@/components/profile/tag-input';
import { Button, Drawer, DrawerTrigger, Field, Input, Section, Textarea, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gpaSummary(academics: Academics): string {
  const parts: string[] = [];
  if (academics.gpa_unweighted !== null) parts.push(`${academics.gpa_unweighted} unweighted`);
  if (academics.gpa_weighted !== null) parts.push(`${academics.gpa_weighted} weighted`);
  if (parts.length === 0) return '';
  const scale = academics.gpa_scale !== null ? ` (${academics.gpa_scale} scale)` : '';
  return `${parts.join(', ')}${scale}`;
}

export function AcademicsSection({ academics }: { academics: Academics }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Academics>(academics);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateAcademics', { body: local }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Academics"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setLocal(academics);
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Academics" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="GPA (unweighted)">
                <Input type="number" step="0.01" min={0} max={5} value={local.gpa_unweighted ?? ''} onChange={(event) => setLocal((a) => ({ ...a, gpa_unweighted: numberOrNull(event.target.value) }))} />
              </Field>
              <Field label="GPA (weighted)">
                <Input type="number" step="0.01" min={0} max={6} value={local.gpa_weighted ?? ''} onChange={(event) => setLocal((a) => ({ ...a, gpa_weighted: numberOrNull(event.target.value) }))} />
              </Field>
              <Field label="Scale">
                <Input type="number" step="0.1" min={4} max={6} value={local.gpa_scale ?? ''} onChange={(event) => setLocal((a) => ({ ...a, gpa_scale: numberOrNull(event.target.value) }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class rank">
                <Input type="number" min={1} value={local.class_rank ?? ''} onChange={(event) => setLocal((a) => ({ ...a, class_rank: numberOrNull(event.target.value) }))} />
              </Field>
              <Field label="Class size">
                <Input type="number" min={1} value={local.class_size ?? ''} onChange={(event) => setLocal((a) => ({ ...a, class_size: numberOrNull(event.target.value) }))} />
              </Field>
            </div>
            <Field label="Course rigor, in your own words">
              <Textarea rows={3} maxLength={1000} value={local.rigor_summary} onChange={(event) => setLocal((a) => ({ ...a, rigor_summary: event.target.value }))} />
            </Field>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Senior year courses</span>
              <TagInput value={local.senior_courses} onChange={(next) => setLocal((a) => ({ ...a, senior_courses: next.slice(0, 15) }))} max={15} placeholder="Type a course, press Enter" />
            </div>
          </DrawerContentShell>
        </Drawer>
      }
    >
      <div>
        <DefRow label="GPA" value={gpaSummary(academics)} />
        <DefRow label="Class rank" value={academics.class_rank && academics.class_size ? `${academics.class_rank} of ${academics.class_size}` : academics.class_rank} />
        <DefRow label="Course rigor" value={academics.rigor_summary} />
        <DefRow label="Senior year courses" value={joinList(academics.senior_courses)} />
      </div>
    </Section>
  );
}
