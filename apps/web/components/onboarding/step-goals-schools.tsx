'use client';

import type { ApplicationDto, SchoolWithRequirementsDto } from '@apogee/shared/api';
import type { ApplicationPlan, CostSensitivity, SchoolSize, SelfAssessment } from '@apogee/shared/domain';
import { APPLICATION_PLANS, COST_SENSITIVITIES, SCHOOL_SIZES, SELF_ASSESSMENTS } from '@apogee/shared/domain';
import type { Demographics, Goals, SchoolRequirementsData } from '@apogee/shared/schemas';
import { X } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChipInput } from '@/components/onboarding/chip-input';
import { detectPlanConflicts } from '@/components/onboarding/plan-conflicts';
import { QuestionLayout } from '@/components/onboarding/question-layout';
import { SchoolSearch } from '@/components/onboarding/school-search';
import { getQuestionCount, getQuestionId } from '@/components/onboarding/step-questions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { useQuestionNav } from '@/components/onboarding/use-question-nav';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Checkbox, ErrorNote, Field, Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { formatDate } from '@/lib/format';

const PLAN_LABELS: Record<ApplicationPlan, string> = {
  ED: 'Early Decision',
  ED2: 'Early Decision II',
  EA: 'Early Action',
  REA: 'Restrictive Early Action',
  RD: 'Regular Decision',
  rolling: 'Rolling',
};

const ASSESSMENT_LABELS: Record<SelfAssessment, string> = { reach: 'Reach', target: 'Target', safety: 'Safety' };
const SIZE_LABELS: Record<SchoolSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
const COST_LABELS: Record<CostSensitivity, string> = {
  low: "Cost isn't a major factor",
  medium: 'Cost matters',
  high: 'Cost is a major factor',
};

type TriValue = 'yes' | 'no' | 'unset';
function toTri(value: boolean | null): TriValue {
  return value === true ? 'yes' : value === false ? 'no' : 'unset';
}
function fromTri(value: string): boolean | null {
  return value === 'yes' ? true : value === 'no' ? false : null;
}
const TRI_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unset', label: 'Rather not say' },
];

interface SchoolPick {
  key: string;
  schoolSlug: string | null;
  schoolName: string;
  plan: ApplicationPlan;
  selfAssessment: SelfAssessment | null;
  requirements: SchoolRequirementsData | null;
  knownDeadline: string | null;
}

function fromApplication(app: ApplicationDto): SchoolPick {
  return {
    key: app.school.slug,
    schoolSlug: app.school.slug,
    schoolName: app.school.name,
    plan: app.plan,
    selfAssessment: app.self_assessment,
    requirements: null,
    knownDeadline: app.deadline,
  };
}

function fromSearchResult(school: SchoolWithRequirementsDto): SchoolPick {
  // Regular Decision by default: Early Decision is binding, so the student must choose it deliberately.
  const plans = school.requirements?.plans ?? [];
  const defaultPlan = plans.find((p) => p.plan === 'RD')?.plan ?? plans.find((p) => p.plan === 'EA')?.plan ?? plans[0]?.plan ?? 'RD';
  return {
    key: school.slug,
    schoolSlug: school.slug,
    schoolName: school.name,
    plan: defaultPlan,
    selfAssessment: null,
    requirements: school.requirements,
    knownDeadline: null,
  };
}

function resolveDeadline(pick: SchoolPick): string | null {
  return pick.requirements?.plans.find((p) => p.plan === pick.plan)?.deadline ?? pick.knownDeadline;
}

/** Step 5: majors, geography and size, cost, demographics, and the school list — one question per screen. */
export function StepGoalsSchools({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const total = getQuestionCount(step);
  const nav = useQuestionNav(step, total);
  const questionId = getQuestionId(step, nav.question);

  const [goals, setGoals] = useState<Goals>(
    onboarding.profile?.goals ?? { intended_majors: [], geography: [], sizes: [], cost_sensitivity: 'medium', needs_aid: false, notes: '' },
  );
  const [demographics, setDemographics] = useState<Demographics>(
    onboarding.profile?.demographics ?? { first_generation: null, financial_constraints: null, family_responsibilities: null, household_notes: null },
  );
  const [picks, setPicks] = useState<SchoolPick[]>(() => onboarding.applications.map(fromApplication));
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const excludedSlugs = new Set(picks.filter((p) => p.schoolSlug).map((p) => p.schoolSlug as string));
  const conflicts = detectPlanConflicts(picks.map((p) => p.plan));

  function updatePick(key: string, patch: Partial<SchoolPick>) {
    setPicks((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addFromSearch(school: SchoolWithRequirementsDto) {
    setPicks((prev) => [...prev, fromSearchResult(school)]);
  }

  function addFreeText(name: string) {
    if (!name) return;
    setPicks((prev) => [...prev, { key: `freetext:${name}:${prev.length}`, schoolSlug: null, schoolName: name, plan: 'RD', selfAssessment: null, requirements: null, knownDeadline: null }]);
  }

  const save = useMutation({
    mutationFn: () => {
      if (picks.length === 0) throw new Error('no_schools');
      return clientApi.call('onboardingStep', {
        body: {
          step: 5,
          data: {
            goals,
            demographics,
            applications: picks.map((p) => ({
              school_slug: p.schoolSlug ?? undefined,
              school_name: p.schoolSlug ? undefined : p.schoolName,
              plan: p.plan,
              self_assessment: p.selfAssessment,
            })),
          },
        },
      });
    },
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: (error) => {
      if (error instanceof Error && error.message === 'no_schools') {
        setSchoolsError('Add at least one school to continue.');
        return;
      }
      toast('Could not save. Try again.');
    },
  });

  if (questionId === 'majors') {
    return (
      <QuestionLayout
        question="What might you study?"
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <ChipInput value={goals.intended_majors} onChange={(next) => setGoals((g) => ({ ...g, intended_majors: next.slice(0, 5) }))} placeholder="e.g. Computer Science" max={5} />
      </QuestionLayout>
    );
  }

  if (questionId === 'geography') {
    return (
      <QuestionLayout
        question="Where would you like to be?"
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <ChipInput value={goals.geography} onChange={(next) => setGoals((g) => ({ ...g, geography: next.slice(0, 10) }))} placeholder="e.g. Midwest, big cities" max={10} />
        <div className="flex flex-col gap-1">
          <span className="text-14 font-medium text-fg">Campus size</span>
          <div className="flex flex-wrap gap-4">
            {SCHOOL_SIZES.map((size) => (
              <label key={size} className="flex items-center gap-2 text-14 text-fg">
                <Checkbox
                  checked={goals.sizes.includes(size)}
                  onCheckedChange={() => setGoals((g) => ({ ...g, sizes: g.sizes.includes(size) ? g.sizes.filter((s) => s !== size) : [...g.sizes, size] }))}
                />
                {SIZE_LABELS[size]}
              </label>
            ))}
          </div>
        </div>
      </QuestionLayout>
    );
  }

  if (questionId === 'cost') {
    return (
      <QuestionLayout
        question="How much does cost matter?"
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <Field label="Cost sensitivity">
          <Select value={goals.cost_sensitivity} onValueChange={(value) => setGoals((g) => ({ ...g, cost_sensitivity: value as typeof goals.cost_sensitivity }))}>
            <SelectTrigger>
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
        </Field>
        <label className="flex items-center justify-between gap-3">
          <span className="text-14 text-fg">Planning to apply for aid</span>
          <Switch checked={goals.needs_aid} onCheckedChange={(checked) => setGoals((g) => ({ ...g, needs_aid: checked }))} />
        </label>
      </QuestionLayout>
    );
  }

  if (questionId === 'demographics') {
    return (
      <QuestionLayout
        question="Anything colleges should know?"
        context="Entirely optional — share only what you want."
        whyWeAsk={<WhyWeAsk>This can help with fee waivers and finding the right fit — Vector only mentions it where you say it is okay to.</WhyWeAsk>}
        onSubmit={(event) => {
          event.preventDefault();
          nav.goNext();
        }}
        onBack={nav.goBack}
      >
        <div className="flex flex-col gap-1">
          <span className="text-14 font-medium text-fg">First-generation college student</span>
          <Segmented aria-label="First-generation college student" value={toTri(demographics.first_generation)} onValueChange={(v) => setDemographics((d) => ({ ...d, first_generation: fromTri(v) }))} options={TRI_OPTIONS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-14 font-medium text-fg">Financial constraints that affect your applications</span>
          <Segmented
            aria-label="Financial constraints that affect your applications"
            value={toTri(demographics.financial_constraints)}
            onValueChange={(v) => setDemographics((d) => ({ ...d, financial_constraints: fromTri(v) }))}
            options={TRI_OPTIONS}
          />
        </div>
        <Field label="Family responsibilities you balance (optional)">
          <Textarea
            rows={2}
            maxLength={1000}
            value={demographics.family_responsibilities ?? ''}
            onChange={(event) => setDemographics((d) => ({ ...d, family_responsibilities: event.target.value || null }))}
          />
        </Field>
      </QuestionLayout>
    );
  }

  // 'schools' — the last question of this step.
  return (
    <QuestionLayout
      question="Which schools?"
      whyWeAsk={<WhyWeAsk>Adding schools now lets Vector build your checklist and timeline the moment you connect Common App next.</WhyWeAsk>}
      onSubmit={(event) => {
        event.preventDefault();
        setSchoolsError(null);
        save.mutate();
      }}
      onBack={nav.goBack}
      continueLoading={save.isPending}
    >
      <SchoolSearch excludedSlugs={excludedSlugs} onAdd={addFromSearch} onAddFreeText={addFreeText} />

      {conflicts.map((warning) => (
        <ErrorNote key={warning}>{warning}</ErrorNote>
      ))}
      {schoolsError ? <ErrorNote>{schoolsError}</ErrorNote> : null}

      <div className="flex flex-col gap-2">
        {picks.length === 0 ? <p className="text-14 text-fg-2">No schools added yet — search above to get started.</p> : null}
        {picks.map((pick) => {
          const deadline = resolveDeadline(pick);
          return (
            <div key={pick.key} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-14 font-medium text-fg">{pick.schoolName}</p>
                <button type="button" onClick={() => setPicks((prev) => prev.filter((p) => p.key !== pick.key))} className="flex text-fg-2 hover:text-fg" aria-label={`Remove ${pick.schoolName}`}>
                  <X />
                </button>
              </div>
              <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-3">
                <Select value={pick.plan} onValueChange={(value) => updatePick(pick.key, { plan: value as ApplicationPlan })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {PLAN_LABELS[plan]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={pick.selfAssessment ?? 'unset'} onValueChange={(value) => updatePick(pick.key, { selfAssessment: value === 'unset' ? null : (value as SelfAssessment) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Reach/target/safety" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not sure yet</SelectItem>
                    {SELF_ASSESSMENTS.map((assessment) => (
                      <SelectItem key={assessment} value={assessment}>
                        {ASSESSMENT_LABELS[assessment]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-12 text-fg-2">{deadline ? `Due ${formatDate(deadline, onboarding.student.timezone)}` : 'Deadline unconfirmed'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </QuestionLayout>
  );
}
