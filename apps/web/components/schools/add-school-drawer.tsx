'use client';

import type { SchoolWithRequirementsDto } from '@apogee/shared/api';
import type { ApplicationPlan } from '@apogee/shared/domain';
import { APPLICATION_PLANS } from '@apogee/shared/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretLeft, Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
  Field,
  Input,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/components/system';
import { PLAN_LABELS } from '@/components/schools/plan-labels';
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

export interface AddSchoolDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludedSlugs: Set<string>;
  timezone: string;
}

export function AddSchoolDrawer({ open, onOpenChange, excludedSlugs, timezone }: AddSchoolDrawerProps) {
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [customName, setCustomName] = useState('');
  const [plan, setPlan] = useState<ApplicationPlan>('RD');

  const results = useQuery({
    queryKey: ['schools-search', debounced],
    queryFn: () => clientApi.call('schoolsSearch', { query: { q: debounced } }),
    enabled: debounced.length > 0 && picked === null,
  });
  const visible = (results.data ?? []).filter((school) => !excludedSlugs.has(school.slug));

  function reset() {
    setQuery('');
    setPicked(null);
    setCustomName('');
    setPlan('RD');
  }

  function pickSchool(school: SchoolWithRequirementsDto) {
    setPicked({ schoolSlug: school.slug, schoolName: school.name, requirements: school.requirements });
    setPlan(school.requirements?.plans[0]?.plan ?? 'RD');
  }

  function pickCustom() {
    const name = (customName || query).trim();
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
        },
      }),
    onSuccess: (application) => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      toast(`${application.school.name} is on your list.`);
      reset();
      onOpenChange(false);
    },
    onError: () => toast('Could not add that school. Try again in a moment.'),
  });

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerTitle>Add a school</DrawerTitle>
        <DrawerBody>
          {picked === null ? (
            <div className="flex flex-col gap-3">
              <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} placeholder="Search for a school" autoFocus />
              {debounced.length > 0 ? (
                <div className="flex flex-col">
                  {visible.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => pickSchool(school)}
                      className="flex h-row items-center justify-between gap-2 rounded px-2 text-left text-14 hover:bg-s2 focus-inset"
                    >
                      <span className="truncate">
                        {school.name} <span className="text-fg-2">{school.city}, {school.state}</span>
                      </span>
                      <Plus className="shrink-0 text-fg-3" />
                    </button>
                  ))}
                  {results.data && visible.length === 0 && !results.isFetching ? (
                    <div className="flex flex-col gap-2 py-2">
                      <p className="text-14 text-fg-2">No match in our dataset.</p>
                      <Field label="School name">
                        <Input value={customName || query.trim()} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Kalamazoo College" />
                      </Field>
                      <Button variant="text" className="h-auto w-fit px-0" disabled={!(customName || query).trim()} onClick={pickCustom}>
                        Add it anyway
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button type="button" onClick={() => setPicked(null)} className="flex w-fit items-center gap-1 text-12 text-fg-2 hover:text-fg focus-inset">
                <CaretLeft /> Back to search
              </button>
              <p className="text-14 font-medium">{picked.schoolName}</p>
              <div className="flex flex-col gap-1">
                <span className="text-14 font-medium text-fg">Plan</span>
                <Select value={plan} onValueChange={(value) => setPlan(value as ApplicationPlan)}>
                  <SelectTrigger>
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
                <p className="text-12 text-fg-2">
                  {resolvedDeadline ? `Due ${formatDate(resolvedDeadline, timezone)}` : 'Deadline unconfirmed — Vector will verify it once you connect Common App.'}
                </p>
              </div>
            </div>
          )}
        </DrawerBody>
        {picked !== null ? (
          <DrawerFooter>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="text" loading={create.isPending} onClick={() => create.mutate()}>
              Add school
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
