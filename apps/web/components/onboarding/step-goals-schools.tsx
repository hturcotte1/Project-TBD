'use client';

import type { ApplicationDto, SchoolWithRequirementsDto } from '@apogee/shared/api';
import type { ApplicationPlan, CostSensitivity, SchoolSize, SelfAssessment } from '@apogee/shared/domain';
import { APPLICATION_PLANS, COST_SENSITIVITIES, SCHOOL_SIZES, SELF_ASSESSMENTS } from '@apogee/shared/domain';
import type { Demographics, Goals, SchoolRequirementsData } from '@apogee/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChipInput } from '@/components/onboarding/chip-input';
import { detectPlanConflicts } from '@/components/onboarding/plan-conflicts';
import { SchoolSearch } from '@/components/onboarding/school-search';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

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

export function StepGoalsSchools({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [goals, setGoals] = useState<Goals>(onboarding.profile?.goals ?? { intended_majors: [], geography: [], sizes: [], cost_sensitivity: 'medium', needs_aid: false, notes: '' });
  const [demographics, setDemographics] = useState<Demographics>(
    onboarding.profile?.demographics ?? { first_generation: null, financial_constraints: null, family_responsibilities: null, household_notes: null },
  );
  const [picks, setPicks] = useState<SchoolPick[]>(() => onboarding.applications.map(fromApplication));

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
        toast({ title: 'Add at least one school to continue.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Could not save — try again.', variant: 'destructive' });
    },
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
        <h1 className="text-xl font-semibold tracking-tight">Goals &amp; schools</h1>
        <p className="text-sm text-muted-foreground">What you&rsquo;re looking for, and where you&rsquo;re applying.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Intended majors</Label>
          <ChipInput value={goals.intended_majors} onChange={(next) => setGoals((g) => ({ ...g, intended_majors: next.slice(0, 5) }))} placeholder="e.g. Computer Science" max={5} />
        </div>
        <div className="space-y-1.5">
          <Label>Geography you&rsquo;re drawn to</Label>
          <ChipInput value={goals.geography} onChange={(next) => setGoals((g) => ({ ...g, geography: next.slice(0, 10) }))} placeholder="e.g. Midwest, big cities" max={10} />
        </div>
        <div className="space-y-1.5">
          <Label>Campus size</Label>
          <div className="flex flex-wrap gap-1.5">
            {SCHOOL_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setGoals((g) => ({ ...g, sizes: g.sizes.includes(size) ? g.sizes.filter((s) => s !== size) : [...g.sizes, size] }))}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  goals.sizes.includes(size) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                )}
              >
                {SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cost-sensitivity">Cost sensitivity</Label>
            <Select value={goals.cost_sensitivity} onValueChange={(value) => setGoals((g) => ({ ...g, cost_sensitivity: value as typeof goals.cost_sensitivity }))}>
              <SelectTrigger id="cost-sensitivity">
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
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Planning to apply for aid</p>
              <p className="text-xs text-muted-foreground">FAFSA, CSS Profile reminders will show up on your timeline.</p>
            </div>
            <Switch checked={goals.needs_aid} onCheckedChange={(checked) => setGoals((g) => ({ ...g, needs_aid: checked }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goals-notes">Anything else about what you&rsquo;re looking for</Label>
          <Textarea id="goals-notes" rows={2} maxLength={2000} value={goals.notes} onChange={(event) => setGoals((g) => ({ ...g, notes: event.target.value }))} />
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">A little more about you</p>
          <p className="text-xs text-muted-foreground">Entirely optional — share only what you want. This can help with fee waivers and finding the right fit.</p>
        </div>
        <div className="space-y-1.5">
          <Label>First-generation college student?</Label>
          <TriToggle value={demographics.first_generation} onChange={(value) => setDemographics((d) => ({ ...d, first_generation: value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Financial constraints that affect your applications (fees, travel, devices)?</Label>
          <TriToggle value={demographics.financial_constraints} onChange={(value) => setDemographics((d) => ({ ...d, financial_constraints: value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="family-responsibilities">Family responsibilities you balance (optional)</Label>
          <Textarea
            id="family-responsibilities"
            rows={2}
            maxLength={1000}
            value={demographics.family_responsibilities ?? ''}
            onChange={(event) => setDemographics((d) => ({ ...d, family_responsibilities: event.target.value || null }))}
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Your school list</p>
        <SchoolSearch excludedSlugs={excludedSlugs} onAdd={addFromSearch} onAddFreeText={addFreeText} />

        {conflicts.length > 0 ? (
          <div className="space-y-1 rounded-md border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn">
            {conflicts.map((warning) => (
              <p key={warning} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
              </p>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          {picks.length === 0 ? <p className="text-sm text-muted-foreground">No schools added yet — search above to get started.</p> : null}
          {picks.map((pick) => {
            const deadline = resolveDeadline(pick);
            return (
              <div key={pick.key} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{pick.schoolName}</p>
                  <button type="button" onClick={() => setPicks((prev) => prev.filter((p) => p.key !== pick.key))} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${pick.schoolName}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                  <Select
                    value={pick.selfAssessment ?? 'unset'}
                    onValueChange={(value) => updatePick(pick.key, { selfAssessment: value === 'unset' ? null : (value as SelfAssessment) })}
                  >
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
                  <p className="flex items-center px-1 text-xs text-muted-foreground">
                    {deadline ? `Due ${formatDate(deadline, onboarding.student.timezone)}` : 'Deadline unconfirmed'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <WhyWeAsk>Adding schools now lets Vector build your checklist and timeline the moment you connect Common App in the next step.</WhyWeAsk>

      <StepActions step={step} loading={save.isPending} />
    </form>
  );
}

function TriToggle({ value, onChange }: { value: boolean | null; onChange: (value: boolean | null) => void }) {
  const options: Array<{ label: string; value: boolean | null }> = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
    { label: 'Prefer not to say', value: null },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium',
            value === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
