'use client';

import type { Goals } from '@apogee/shared/schemas';
import { COST_SENSITIVITIES, SCHOOL_SIZES } from '@apogee/shared/domain';
import type { CostSensitivity, SchoolSize } from '@apogee/shared/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DefRow, joinList } from '@/components/profile/def-list';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { TagInput } from '@/components/profile/tag-input';
import { Button, Checkbox, Drawer, DrawerTrigger, Field, Section, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const SIZE_LABELS: Record<SchoolSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
const COST_LABELS: Record<CostSensitivity, string> = { low: 'Not a big factor', medium: 'Somewhat important', high: 'Very important' };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function GoalsSection({ goals }: { goals: Goals }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Goals>(goals);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateGoals', { body: local }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Goals"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setLocal(goals);
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Goals" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Intended majors</span>
              <TagInput value={local.intended_majors} onChange={(next) => setLocal((g) => ({ ...g, intended_majors: next.slice(0, 5) }))} max={5} placeholder="Type a major, press Enter" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Preferred geography</span>
              <TagInput value={local.geography} onChange={(next) => setLocal((g) => ({ ...g, geography: next.slice(0, 10) }))} max={10} placeholder="Midwest, big cities" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">School size</span>
              <div className="flex flex-wrap gap-4">
                {SCHOOL_SIZES.map((size) => (
                  <label key={size} className="flex items-center gap-2 text-14 text-fg">
                    <Checkbox checked={local.sizes.includes(size)} onCheckedChange={() => setLocal((g) => ({ ...g, sizes: toggle(g.sizes, size) }))} />
                    {SIZE_LABELS[size]}
                  </label>
                ))}
              </div>
            </div>
            <Field label="How much does cost drive your list">
              <Select value={local.cost_sensitivity} onValueChange={(value) => setLocal((g) => ({ ...g, cost_sensitivity: value as CostSensitivity }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_SENSITIVITIES.map((level) => (
                    <SelectItem key={level} value={level}>
                      {COST_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center justify-between gap-3">
              <span className="text-14 text-fg">I will need financial aid</span>
              <Switch checked={local.needs_aid} onCheckedChange={(checked) => setLocal((g) => ({ ...g, needs_aid: checked }))} />
            </label>
            <Field label="Anything else about what you are looking for">
              <Textarea rows={3} maxLength={2000} value={local.notes} onChange={(event) => setLocal((g) => ({ ...g, notes: event.target.value }))} />
            </Field>
          </DrawerContentShell>
        </Drawer>
      }
    >
      <div>
        <DefRow label="Intended majors" value={joinList(goals.intended_majors)} />
        <DefRow label="Preferred geography" value={joinList(goals.geography)} />
        <DefRow label="School size" value={joinList(goals.sizes.map((s) => SIZE_LABELS[s]))} />
        <DefRow label="Cost sensitivity" value={COST_LABELS[goals.cost_sensitivity]} />
        <DefRow label="Needs financial aid" value={goals.needs_aid ? 'Yes' : 'No'} />
        <DefRow label="Notes" value={goals.notes} />
      </div>
    </Section>
  );
}
