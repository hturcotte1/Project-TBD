'use client';

import type { StudentProfileDto } from '@apogee/shared/api';
import { TEST_OPTIONAL_STANCES } from '@apogee/shared/domain';
import { Academics, TestScores } from '@apogee/shared/schemas';
import { Plus, Trash } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { TranscriptUpload } from '@/components/onboarding/transcript-upload';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

type SatEntry = TestScores['sat'][number];
type ActEntry = TestScores['act'][number];
type ApEntry = TestScores['ap'][number];

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

/** Step 2: transcript upload, GPA, test scores — one question per screen. Senior courses and IB
 * scores stay in state (round-tripped from any existing profile or a transcript extraction) but
 * have no editor here — the spec's question list for this step names only GPA/scale/rank/rigor
 * and SAT/ACT/AP. */
export function StepAcademics({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);

  const [academics, setAcademics] = useState<Academics>(onboarding.profile?.academics ?? Academics.parse({}));
  const [testScores, setTestScores] = useState<TestScores>(onboarding.profile?.test_scores ?? TestScores.parse({}));

  function applyProfile(profile: StudentProfileDto) {
    setAcademics(profile.academics);
    setTestScores(profile.test_scores);
  }

  const save = useMutation({
    mutationFn: (overrideTestScores?: TestScores) => clientApi.call('onboardingStep', { body: { step: 2, data: { academics, test_scores: overrideTestScores ?? testScores } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast('Could not save. Try again.'),
  });

  if (questionId === 'transcript') {
    return (
      <QuestionLayout
        question="Do you have a transcript to upload?"
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
        footerExtra={
          <Button variant="text" onClick={() => nav.goNext()}>
            Skip for now
          </Button>
        }
      >
        <TranscriptUpload onApplied={applyProfile} />
      </QuestionLayout>
    );
  }

  if (questionId === 'gpa') {
    return (
      <QuestionLayout
        question="What's your GPA?"
        whyWeAsk={<WhyWeAsk>Colleges read your transcript in context. This helps Vector describe your rigor accurately when it drafts anything on your behalf.</WhyWeAsk>}
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Unweighted">
            <Input type="number" step="0.01" min={0} max={5} value={academics.gpa_unweighted ?? ''} onChange={(event) => setAcademics((a) => ({ ...a, gpa_unweighted: numberOrNull(event.target.value) }))} />
          </Field>
          <Field label="Weighted">
            <Input type="number" step="0.01" min={0} max={6} value={academics.gpa_weighted ?? ''} onChange={(event) => setAcademics((a) => ({ ...a, gpa_weighted: numberOrNull(event.target.value) }))} />
          </Field>
          <Field label="Scale">
            <Input type="number" step="0.1" min={4} max={6} value={academics.gpa_scale ?? ''} onChange={(event) => setAcademics((a) => ({ ...a, gpa_scale: numberOrNull(event.target.value) }))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class rank">
            <Input type="number" min={1} value={academics.class_rank ?? ''} onChange={(event) => setAcademics((a) => ({ ...a, class_rank: numberOrNull(event.target.value) }))} />
          </Field>
          <Field label="Class size">
            <Input type="number" min={1} value={academics.class_size ?? ''} onChange={(event) => setAcademics((a) => ({ ...a, class_size: numberOrNull(event.target.value) }))} />
          </Field>
        </div>
        <Field label="Course rigor, in your own words">
          <Textarea rows={3} maxLength={1000} value={academics.rigor_summary} onChange={(event) => setAcademics((a) => ({ ...a, rigor_summary: event.target.value }))} placeholder="Most rigorous track my school offers, 7 APs by graduation." />
        </Field>
      </QuestionLayout>
    );
  }

  // 'test-scores' — the last question of this step.
  return (
    <QuestionLayout
      question="Any test scores?"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined);
      }}
      onBack={nav.goBack}
      continueLoading={save.isPending}
      footerExtra={
        <Button
          variant="text"
          onClick={() => {
            const next: TestScores = { ...testScores, test_optional_stance: 'go_test_optional' };
            setTestScores(next);
            save.mutate(next);
          }}
        >
          I'm test-optional
        </Button>
      }
    >
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
      <Field label="Test-optional plans">
        <Select value={testScores.test_optional_stance} onValueChange={(value) => setTestScores((t) => ({ ...t, test_optional_stance: value as TestScores['test_optional_stance'] }))}>
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
    </QuestionLayout>
  );
}
