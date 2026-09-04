'use client';

import type { Demographics } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

const TRI_OPTIONS: Array<{ value: boolean | null; label: string }> = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
  { value: null, label: "Rather not say" },
];

function TriBooleanField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        {TRI_OPTIONS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              value === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DemographicsSection({ demographics }: { demographics: Demographics }) {
  const { toast } = useToast();
  const [local, setLocal] = useState<Demographics>(demographics);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateDemographics', { body: local }),
    onSuccess: (updated) => {
      setLocal(updated.demographics);
      toast({ title: 'Saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>What you chose to share</CardTitle>
        <CardDescription>Entirely optional. Some schools ask about this context — the agent only mentions it where you&rsquo;ve said it&rsquo;s okay to.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TriBooleanField label="First-generation college student" value={local.first_generation} onChange={(value) => setLocal((d) => ({ ...d, first_generation: value }))} />
            <TriBooleanField
              label="Financial constraints affect your college choice"
              value={local.financial_constraints}
              onChange={(value) => setLocal((d) => ({ ...d, financial_constraints: value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-family">Family responsibilities (optional)</Label>
            <Textarea
              id="demo-family"
              rows={2}
              maxLength={1000}
              value={local.family_responsibilities ?? ''}
              onChange={(event) => setLocal((d) => ({ ...d, family_responsibilities: event.target.value || null }))}
              placeholder="e.g. Watch younger siblings after school most days."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demo-household">Household notes (optional)</Label>
            <Textarea
              id="demo-household"
              rows={2}
              maxLength={1000}
              value={local.household_notes ?? ''}
              onChange={(event) => setLocal((d) => ({ ...d, household_notes: event.target.value || null }))}
              placeholder="Anything else worth knowing about your situation at home."
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
