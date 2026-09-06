'use client';

import type { Demographics } from '@apogee/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { DefRow } from '@/components/profile/def-list';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { Field, Segmented, Section, Textarea, toast } from '@/components/system';
import { Drawer, DrawerTrigger, Button } from '@/components/system';
import { clientApi } from '@/lib/api.client';

type TriValue = 'yes' | 'no' | 'unset';

function toTri(value: boolean | null): TriValue {
  return value === true ? 'yes' : value === false ? 'no' : 'unset';
}
function fromTri(value: string): boolean | null {
  return value === 'yes' ? true : value === 'no' ? false : null;
}
function triLabel(value: boolean | null): string {
  return value === true ? 'Yes' : value === false ? 'No' : '';
}

const TRI_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unset', label: 'Rather not say' },
];

export function DemographicsSection({ demographics }: { demographics: Demographics }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Demographics>(demographics);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateDemographics', { body: local }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Demographics"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setLocal(demographics);
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Demographics" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <p className="text-12 text-fg-2">Entirely optional. Some schools ask about this context; Vector only mentions it where you have said it is okay to.</p>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">First-generation college student</span>
              <Segmented aria-label="First-generation college student" value={toTri(local.first_generation)} onValueChange={(v) => setLocal((d) => ({ ...d, first_generation: fromTri(v) }))} options={TRI_OPTIONS} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-14 font-medium text-fg">Financial constraints affect your college choice</span>
              <Segmented
                aria-label="Financial constraints affect your college choice"
                value={toTri(local.financial_constraints)}
                onValueChange={(v) => setLocal((d) => ({ ...d, financial_constraints: fromTri(v) }))}
                options={TRI_OPTIONS}
              />
            </div>
            <Field label="Family responsibilities" help="Optional.">
              <Textarea rows={2} maxLength={1000} value={local.family_responsibilities ?? ''} onChange={(event) => setLocal((d) => ({ ...d, family_responsibilities: event.target.value || null }))} placeholder="Watch younger siblings after school most days." />
            </Field>
            <Field label="Household notes" help="Optional.">
              <Textarea rows={2} maxLength={1000} value={local.household_notes ?? ''} onChange={(event) => setLocal((d) => ({ ...d, household_notes: event.target.value || null }))} placeholder="Anything else worth knowing about your situation at home." />
            </Field>
          </DrawerContentShell>
        </Drawer>
      }
    >
      <div>
        <DefRow label="First-generation" value={triLabel(demographics.first_generation)} />
        <DefRow label="Financial constraints" value={triLabel(demographics.financial_constraints)} />
        <DefRow label="Family responsibilities" value={demographics.family_responsibilities} />
        <DefRow label="Household notes" value={demographics.household_notes} />
      </div>
    </Section>
  );
}
