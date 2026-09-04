'use client';

import type { SchoolWithRequirementsDto } from '@tbd/shared/api';
import type { ApplicationPlan, SelfAssessment } from '@tbd/shared/domain';
import { APPLICATION_PLANS, SELF_ASSESSMENTS } from '@tbd/shared/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, School as SchoolIcon, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLAN_LABELS, SELF_ASSESSMENT_LABELS } from '@/components/schools/plan-labels';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatDate } from '@/lib/format';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface Picked {
  schoolSlug: string | null;
  schoolName: string;
  requirements: SchoolWithRequirementsDto['requirements'];
}

export interface AddSchoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludedSlugs: Set<string>;
  timezone: string;
}

export function AddSchoolDialog({ open, onOpenChange, excludedSlugs, timezone }: AddSchoolDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [plan, setPlan] = useState<ApplicationPlan>('RD');
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessment | null>(null);

  const results = useQuery({
    queryKey: ['schools-search', debounced],
    queryFn: () => clientApi.call('schoolsSearch', { query: { q: debounced } }),
    enabled: debounced.length > 0 && picked === null,
  });
  const visible = (results.data ?? []).filter((school) => !excludedSlugs.has(school.slug));

  function reset() {
    setQuery('');
    setPicked(null);
    setPlan('RD');
    setSelfAssessment(null);
  }

  function pickSchool(school: SchoolWithRequirementsDto) {
    setPicked({ schoolSlug: school.slug, schoolName: school.name, requirements: school.requirements });
    setPlan(school.requirements?.plans[0]?.plan ?? 'RD');
  }

  function pickFreeText(name: string) {
    if (!name) return;
    setPicked({ schoolSlug: null, schoolName: name, requirements: null });
    setPlan('RD');
  }

  const resolvedDeadline = picked?.requirements?.plans.find((p) => p.plan === plan)?.deadline ?? null;

  const create = useMutation({
    mutationFn: () =>
      clientApi.call('applicationCreate', {
        body: {
          school_slug: picked?.schoolSlug ?? undefined,
          school_name: picked?.schoolSlug ? undefined : (picked?.schoolName ?? ''),
          plan,
          self_assessment: selfAssessment,
        },
      }),
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast({ title: 'School added', description: `${application.school.name} is on your list.` });
      reset();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Could not add that school', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a school</DialogTitle>
          <DialogDescription>Search our dataset, or add a school we don&rsquo;t have yet.</DialogDescription>
        </DialogHeader>

        {picked === null ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a school…" className="pl-8" autoFocus />
            </div>
            {debounced.length > 0 ? (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {results.isFetching ? <p className="px-1 text-xs text-muted-foreground">Searching…</p> : null}
                {visible.map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => pickSchool(school)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SchoolIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {school.name} <span className="text-xs text-muted-foreground">— {school.city}, {school.state}</span>
                      </span>
                    </span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {results.data && visible.length === 0 && !results.isFetching ? (
                  <div className="space-y-1.5 rounded-md border border-dashed border-border p-3 text-sm">
                    <p className="text-muted-foreground">No match in our dataset.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => pickFreeText(query.trim())}>
                      Add &ldquo;{query.trim()}&rdquo; anyway
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => setPicked(null)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to search
            </button>
            <p className="text-sm font-medium">{picked.schoolName}</p>
            <div className="space-y-1.5">
              <Label htmlFor="add-school-plan">Plan</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as ApplicationPlan)}>
                <SelectTrigger id="add-school-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(picked.requirements?.plans.map((p) => p.plan) ?? APPLICATION_PLANS).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLAN_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{resolvedDeadline ? `Due ${formatDate(resolvedDeadline, timezone)}` : 'Deadline unconfirmed — Remy will verify it once you connect Common App.'}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-school-assessment">How does it feel — reach, target, or safety?</Label>
              <Select value={selfAssessment ?? 'unset'} onValueChange={(value) => setSelfAssessment(value === 'unset' ? null : (value as SelfAssessment))}>
                <SelectTrigger id="add-school-assessment">
                  <SelectValue placeholder="Not sure yet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not sure yet</SelectItem>
                  {SELF_ASSESSMENTS.map((assessment) => (
                    <SelectItem key={assessment} value={assessment}>
                      {SELF_ASSESSMENT_LABELS[assessment]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" className="w-full" onClick={() => create.mutate()} loading={create.isPending}>
              Add school
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
