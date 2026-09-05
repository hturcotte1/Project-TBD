'use client';

import type { TestScores } from '@apogee/shared/schemas';
import { TEST_OPTIONAL_STANCES } from '@apogee/shared/domain';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...entries, newEntry()])}>
          <Plus className="h-3.5 w-3.5" /> Add {title}
        </Button>
      </div>
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2.5">
          {renderRow(entry, (next) => onChange(entries.map((e, i) => (i === index ? next : e))))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8"
            aria-label={`Remove ${title} entry`}
            onClick={() => onChange(entries.filter((_, i) => i !== index))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number | null; min: number; max: number; onChange: (value: number | null) => void }) {
  return (
    <div className="w-24 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" min={min} max={max} value={value ?? ''} onChange={(event) => onChange(numberOrNull(event.target.value))} />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="w-40 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} maxLength={80} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DateField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <div className="w-40 space-y-1">
      <Label className="text-xs text-muted-foreground">Date</Label>
      <Input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} />
    </div>
  );
}

export function TestScoresSection({ testScores }: { testScores: TestScores }) {
  const { toast } = useToast();
  const [local, setLocal] = useState<TestScores>(testScores);

  const save = useMutation({
    mutationFn: () => clientApi.call('profileUpdateTestScores', { body: local }),
    onSuccess: (updated) => {
      setLocal(updated.test_scores);
      toast({ title: 'Test scores saved' });
    },
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test scores</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
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

          <div className="space-y-1.5">
            <Label htmlFor="test-stance">Test-optional plans</Label>
            <Select value={local.test_optional_stance} onValueChange={(value) => setLocal((t) => ({ ...t, test_optional_stance: value as TestScores['test_optional_stance'] }))}>
              <SelectTrigger id="test-stance">
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
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              Save test scores
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
