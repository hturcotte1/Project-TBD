'use client';

import type { Academics } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ChipInput } from '@/components/onboarding/chip-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function AcademicsSection({ academics }: { academics: Academics }) {
  const { toast } = useToast();
  const [local, setLocal] = useState<Academics>(academics);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateAcademics', { body: local }),
    onSuccess: (updated) => {
      setLocal(updated.academics);
      toast({ title: 'Academics saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academics</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acad-gpa-unweighted">GPA (unweighted)</Label>
              <Input
                id="acad-gpa-unweighted"
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={local.gpa_unweighted ?? ''}
                onChange={(event) => setLocal((a) => ({ ...a, gpa_unweighted: numberOrNull(event.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acad-gpa-weighted">GPA (weighted)</Label>
              <Input
                id="acad-gpa-weighted"
                type="number"
                step="0.01"
                min={0}
                max={6}
                value={local.gpa_weighted ?? ''}
                onChange={(event) => setLocal((a) => ({ ...a, gpa_weighted: numberOrNull(event.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acad-gpa-scale">Scale</Label>
              <Input
                id="acad-gpa-scale"
                type="number"
                step="0.1"
                min={4}
                max={6}
                value={local.gpa_scale ?? ''}
                onChange={(event) => setLocal((a) => ({ ...a, gpa_scale: numberOrNull(event.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acad-class-rank">Class rank</Label>
              <Input
                id="acad-class-rank"
                type="number"
                min={1}
                value={local.class_rank ?? ''}
                onChange={(event) => setLocal((a) => ({ ...a, class_rank: numberOrNull(event.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acad-class-size">Class size</Label>
              <Input
                id="acad-class-size"
                type="number"
                min={1}
                value={local.class_size ?? ''}
                onChange={(event) => setLocal((a) => ({ ...a, class_size: numberOrNull(event.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acad-rigor">Course rigor, in your own words</Label>
            <Textarea
              id="acad-rigor"
              rows={3}
              maxLength={1000}
              value={local.rigor_summary}
              onChange={(event) => setLocal((a) => ({ ...a, rigor_summary: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Senior year courses</Label>
            <ChipInput value={local.senior_courses} onChange={(next) => setLocal((a) => ({ ...a, senior_courses: next.slice(0, 15) }))} max={15} placeholder="Type a course, press Enter" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save academics
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
