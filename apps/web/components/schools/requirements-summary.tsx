import type { SchoolRequirementsData } from '@apogee/shared/schemas';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

const TEST_POLICY_LABELS: Record<SchoolRequirementsData['test_policy'], string> = {
  required: 'Test scores required',
  optional: 'Test-optional',
  blind: 'Test-blind (scores not considered)',
  flexible: 'Test-flexible',
};

const INTERVIEW_POLICY_LABELS: Record<SchoolRequirementsData['interview_policy'], string> = {
  none: 'No interview',
  optional: 'Optional interview',
  recommended: 'Interview recommended',
  required: 'Interview required',
  by_invitation: 'Interview by invitation',
};

function recommendationsSummary(reqs: SchoolRequirementsData): string {
  const { teacher_min, teacher_max, counselor_required, other_max } = reqs.recommendations;
  const parts: string[] = [];
  if (teacher_max > 0) parts.push(teacher_min > 0 ? `${teacher_min}-${Math.max(teacher_min, teacher_max)} teacher letters` : `up to ${teacher_max} teacher letters (optional)`);
  parts.push(counselor_required ? 'counselor letter required' : 'counselor letter optional');
  if (other_max > 0) parts.push(`up to ${other_max} other`);
  return parts.join(', ');
}

export function RequirementsSummary({ requirements }: { requirements: SchoolRequirementsData | null }) {
  if (!requirements) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Requirements haven&rsquo;t been confirmed for this school yet.</CardContent>
      </Card>
    );
  }

  const fee = requirements.application_fee;

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
        <Field label="Testing">{TEST_POLICY_LABELS[requirements.test_policy]}</Field>
        <Field label="Recommendations">{recommendationsSummary(requirements)}</Field>
        <Field label="CSS Profile">{requirements.css_profile.required ? 'Required' : 'Not required'}</Field>
        <Field label="Interview">{INTERVIEW_POLICY_LABELS[requirements.interview_policy]}</Field>
        <Field label="Application fee">
          {fee === null ? 'Amount unconfirmed' : fee === 0 ? 'No fee' : `$${fee}`}
          {requirements.fee_waiver_eligible ? ' · fee waivers available' : ''}
        </Field>
        {requirements.needs_verification ? <Field label="Note">Some of these details are unverified — Vector will confirm them on the next sync.</Field> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p>{children}</p>
    </div>
  );
}
