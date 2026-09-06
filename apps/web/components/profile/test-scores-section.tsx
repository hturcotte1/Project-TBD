'use client';

import type { TestScores } from '@apogee/shared/schemas';
import { TEST_OPTIONAL_STANCES } from '@apogee/shared/domain';
import { Trash, Plus } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DefRow } from '@/components/profile/def-list';
import { DrawerContentShell } from '@/components/profile/drawer-shell';
import { Button, Drawer, DrawerTrigger, Field, Input, Section, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

type SatEntry = TestScores['sat'][number];
type ActEntry = TestScores['act'][number];
type ApEntry = TestScores['ap'][number];
type IbEntry = TestScores['ib'][number];

const TEST_STANCE_LABELS: Record<(typeof TEST_OPTIONAL_STANCES)[number], string> = {
  submit_all: 'Submit all my scores',
  submit_selectively: 'Submit only my best scores',
  go_test_optional: 'Go test-optional everywhere I can',
  undecided: "Haven't decided yet",
};

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ScoreList<T>({
  title,
  entries,
  onChange,
  newEntry,
  renderRow,
}: {
  title: string;
  entries: T[];
  onChange: (next: T[]) => void;
  newEntry: () => T;
  renderRow: (entry: T, onChange: (next: T) => void) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-14 font-medium text-fg">{title}</span>
        <Button variant="text" size="sm" onClick={() => onChange([...entries, newEntry()])}>
          <Plus /> Add {title}
        </Button>
      </div>
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          {renderRow(entry, (next) => onChange(entries.map((e, i) => (i === index ? next : e))))}
          <Button variant="quiet" size="sm" iconOnly aria-label={`Remove ${title} entry`} onClick={() => onChange(entries.filter((_, i) => i !== index))}>
            <Trash />
          </Button>
        </div>
      ))}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number | null; min: number; max: number; onChange: (value: number | null) => void }) {
  return (
    <Field label={label} className="w-24">
      <Input type="number" min={min} max={max} value={value ?? ''} onChange={(event) => onChange(numberOrNull(event.target.value))} />
    </Field>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} className="w-40">
      <Input value={value} maxLength={80} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function DateField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <Field label="Date" className="w-40">
      <Input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} />
    </Field>
  );
}

function satSummary(entries: SatEntry[]): string {
  return entries.map((e) => String(e.total)).join(', ');
}
function actSummary(entries: ActEntry[]): string {
  return entries.map((e) => String(e.composite)).join(', ');
}
function apSummary(entries: ApEntry[]): string {
  return entries.map((e) => (e.score !== null ? `${e.subject} (${e.score})` : e.subject)).join(', ');
}
function ibSummary(entries: IbEntry[]): string {
  return entries.map((e) => (e.score !== null ? `${e.subject} (${e.score})` : e.subject)).join(', ');
}

export function TestScoresSection({ testScores }: { testScores: TestScores }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<TestScores>(testScores);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateTestScores', { body: local }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setOpen(false);
      toast('Saved.');
    },
    onError: () => toast('Could not save. Try again.'),
  });

  return (
    <Section
      title="Test scores"
      aside={
        <Drawer
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setLocal(testScores);
          }}
        >
          <DrawerTrigger asChild>
            <Button variant="text" className="h-auto px-0">
              Edit
            </Button>
          </DrawerTrigger>
          <DrawerContentShell title="Test scores" onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending}>
            <ScoreList<SatEntry>
              title="SAT"
              entries={local.sat}
              onChange={(next) => setLocal((t) => ({ ...t, sat: next }))}
              newEntry={() => ({ total: 1200, ebrw: null, math: null, date: null })}
              renderRow={(entry, onChange) => (
                <>
                  <NumberField label="Total" value={entry.total} min={400} max={1600} onChange={(v) => onChange({ ...entry, total: v ?? 400 })} />
                  <NumberField label="EBRW" value={entry.ebrw} min={200} max={800} onChange={(v) => onChange({ ...entry, ebrw: v })} />
                  <NumberField label="Math" value={entry.math} min={200} max={800} onChange={(v) => onChange({ ...entry, math: v })} />
                  <DateField value={entry.date} onChange={(v) => onChange({ ...entry, date: v })} />
                </>
              )}
            />
            <ScoreList<ActEntry>
              title="ACT"
              entries={local.act}
              onChange={(next) => setLocal((t) => ({ ...t, act: next }))}
              newEntry={() => ({ composite: 24, english: null, math: null, reading: null, science: null, date: null })}
              renderRow={(entry, onChange) => (
                <>
                  <NumberField label="Composite" value={entry.composite} min={1} max={36} onChange={(v) => onChange({ ...entry, composite: v ?? 24 })} />
                  <NumberField label="English" value={entry.english} min={1} max={36} onChange={(v) => onChange({ ...entry, english: v })} />
                  <NumberField label="Math" value={entry.math} min={1} max={36} onChange={(v) => onChange({ ...entry, math: v })} />
                  <NumberField label="Reading" value={entry.reading} min={1} max={36} onChange={(v) => onChange({ ...entry, reading: v })} />
                  <NumberField label="Science" value={entry.science} min={1} max={36} onChange={(v) => onChange({ ...entry, science: v })} />
                  <DateField value={entry.date} onChange={(v) => onChange({ ...entry, date: v })} />
                </>
              )}
            />
            <ScoreList<ApEntry>
              title="AP"
              entries={local.ap}
              onChange={(next) => setLocal((t) => ({ ...t, ap: next }))}
              newEntry={() => ({ subject: '', score: null, year: null })}
              renderRow={(entry, onChange) => (
                <>
                  <TextField label="Subject" value={entry.subject} onChange={(v) => onChange({ ...entry, subject: v })} />
                  <NumberField label="Score" value={entry.score} min={1} max={5} onChange={(v) => onChange({ ...entry, score: v })} />
                  <NumberField label="Year" value={entry.year} min={2015} max={2030} onChange={(v) => onChange({ ...entry, year: v })} />
                </>
              )}
            />
            <ScoreList<IbEntry>
              title="IB"
              entries={local.ib}
              onChange={(next) => setLocal((t) => ({ ...t, ib: next }))}
              newEntry={() => ({ subject: '', level: null, score: null, year: null })}
              renderRow={(entry, onChange) => (
                <>
                  <TextField label="Subject" value={entry.subject} onChange={(v) => onChange({ ...entry, subject: v })} />
                  <NumberField label="Score" value={entry.score} min={1} max={7} onChange={(v) => onChange({ ...entry, score: v })} />
                  <NumberField label="Year" value={entry.year} min={2015} max={2030} onChange={(v) => onChange({ ...entry, year: v })} />
                </>
              )}
            />
            <Field label="Test-optional plans">
              <Select value={local.test_optional_stance} onValueChange={(value) => setLocal((t) => ({ ...t, test_optional_stance: value as TestScores['test_optional_stance'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_OPTIONAL_STANCES.map((stance) => (
                    <SelectItem key={stance} value={stance}>
                      {TEST_STANCE_LABELS[stance]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </DrawerContentShell>
        </Drawer>
      }
    >
      <div>
        <DefRow label="SAT" value={satSummary(testScores.sat)} />
        <DefRow label="ACT" value={actSummary(testScores.act)} />
        <DefRow label="AP" value={apSummary(testScores.ap)} />
        <DefRow label="IB" value={ibSummary(testScores.ib)} />
        <DefRow label="Test-optional plans" value={TEST_STANCE_LABELS[testScores.test_optional_stance]} />
      </div>
    </Section>
  );
}
