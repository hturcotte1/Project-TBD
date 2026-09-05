'use client';

import type { StudentProfileDto } from '@apogee/shared/api';
import { TEST_OPTIONAL_STANCES } from '@apogee/shared/domain';
import { Academics, TestScores } from '@apogee/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChipInput } from '@/components/onboarding/chip-input';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { TranscriptUpload } from '@/components/onboarding/transcript-upload';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

export function StepAcademics({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [academics, setAcademics] = useState<Academics>(onboarding.profile?.academics ?? Academics.parse({}));
  const [testScores, setTestScores] = useState<TestScores>(onboarding.profile?.test_scores ?? TestScores.parse({}));

  function applyProfile(profile: StudentProfileDto) {
    setAcademics(profile.academics);
    setTestScores(profile.test_scores);
  }

  const save = useMutation({
    mutationFn: () => clientApi.call('onboardingStep', { body: { step: 2, data: { academics, test_scores: testScores } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Academics</h1>
        <p className="text-sm text-muted-foreground">GPA, courses, and test scores — the numbers colleges see first.</p>
      </div>

      <TranscriptUpload onApplied={applyProfile} />

      <div className="space-y-3">
        <p className="text-sm font-medium">GPA</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gpa-unweighted">Unweighted</Label>
            <Input
              id="gpa-unweighted"
              type="number"
              step="0.01"
              min={0}
              max={5}
              value={academics.gpa_unweighted ?? ''}
              onChange={(event) => setAcademics((a) => ({ ...a, gpa_unweighted: numberOrNull(event.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gpa-weighted">Weighted</Label>
            <Input
              id="gpa-weighted"
              type="number"
              step="0.01"
              min={0}
              max={6}
              value={academics.gpa_weighted ?? ''}
              onChange={(event) => setAcademics((a) => ({ ...a, gpa_weighted: numberOrNull(event.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gpa-scale">Scale</Label>
            <Input
              id="gpa-scale"
              type="number"
              step="0.1"
              min={4}
              max={6}
              value={academics.gpa_scale ?? ''}
              onChange={(event) => setAcademics((a) => ({ ...a, gpa_scale: numberOrNull(event.target.value) }))}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="class-rank">Class rank</Label>
          <Input
            id="class-rank"
            type="number"
            min={1}
            value={academics.class_rank ?? ''}
            onChange={(event) => setAcademics((a) => ({ ...a, class_rank: numberOrNull(event.target.value) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="class-size">Class size</Label>
          <Input
            id="class-size"
            type="number"
            min={1}
            value={academics.class_size ?? ''}
            onChange={(event) => setAcademics((a) => ({ ...a, class_size: numberOrNull(event.target.value) }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rigor">Course rigor, in your own words</Label>
        <Textarea
          id="rigor"
          maxLength={1000}
          rows={3}
          value={academics.rigor_summary}
          onChange={(event) => setAcademics((a) => ({ ...a, rigor_summary: event.target.value }))}
          placeholder="e.g. Most rigorous track my school offers — 7 APs by graduation."
        />
        <WhyWeAsk>Colleges read your transcript in context. This helps Vector describe your rigor accurately when it drafts anything on your behalf.</WhyWeAsk>
      </div>

      <div className="space-y-1.5">
        <Label>Senior year courses</Label>
        <ChipInput
          value={academics.senior_courses}
          onChange={(next) => setAcademics((a) => ({ ...a, senior_courses: next.slice(0, 15) }))}
          placeholder="Type a course, press Enter"
          max={15}
        />
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm font-medium">Test scores</p>

        <ScoreList<SatEntry>
          title="SAT"
          entries={testScores.sat}
          onChange={(next) => setTestScores((t) => ({ ...t, sat: next }))}
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
          entries={testScores.act}
          onChange={(next) => setTestScores((t) => ({ ...t, act: next }))}
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
          entries={testScores.ap}
          onChange={(next) => setTestScores((t) => ({ ...t, ap: next }))}
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
          entries={testScores.ib}
          onChange={(next) => setTestScores((t) => ({ ...t, ib: next }))}
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
          <Select
            value={testScores.test_optional_stance}
            onValueChange={(value) => setTestScores((t) => ({ ...t, test_optional_stance: value as TestScores['test_optional_stance'] }))}
          >
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
      </div>

      <StepActions step={step} loading={save.isPending} />
    </form>
  );
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

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
}) {
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
