'use client';

import type { Goals } from '@apogee/shared/schemas';
import { COST_SENSITIVITIES, SCHOOL_SIZES } from '@apogee/shared/domain';
import type { CostSensitivity, SchoolSize } from '@apogee/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ChipInput } from '@/components/onboarding/chip-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

const SIZE_LABELS: Record<SchoolSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
const COST_LABELS: Record<CostSensitivity, string> = { low: 'Not a big factor', medium: 'Somewhat important', high: 'Very important' };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function GoalsSection({ goals }: { goals: Goals }) {
  const { toast } = useToast();
  const [local, setLocal] = useState<Goals>(goals);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateGoals', { body: local }),
    onSuccess: (updated) => {
      setLocal(updated.goals);
      toast({ title: 'Goals saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Intended majors</Label>
            <ChipInput value={local.intended_majors} onChange={(next) => setLocal((g) => ({ ...g, intended_majors: next.slice(0, 5) }))} max={5} placeholder="Type a major, press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred geography</Label>
            <ChipInput value={local.geography} onChange={(next) => setLocal((g) => ({ ...g, geography: next.slice(0, 10) }))} max={10} placeholder="e.g. Midwest, big cities" />
          </div>
          <div className="space-y-1.5">
            <Label>School size</Label>
            <div className="flex flex-wrap gap-1.5">
              {SCHOOL_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setLocal((g) => ({ ...g, sizes: toggle(g.sizes, size) }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    local.sizes.includes(size) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {SIZE_LABELS[size]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goals-cost">How much does cost drive your list?</Label>
            <Select value={local.cost_sensitivity} onValueChange={(value) => setLocal((g) => ({ ...g, cost_sensitivity: value as CostSensitivity }))}>
              <SelectTrigger id="goals-cost">
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
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm font-medium">I&rsquo;ll need financial aid</span>
            <Switch checked={local.needs_aid} onCheckedChange={(checked) => setLocal((g) => ({ ...g, needs_aid: checked }))} />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="goals-notes">Anything else about what you&rsquo;re looking for</Label>
            <Textarea id="goals-notes" rows={3} maxLength={2000} value={local.notes} onChange={(event) => setLocal((g) => ({ ...g, notes: event.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save goals
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
