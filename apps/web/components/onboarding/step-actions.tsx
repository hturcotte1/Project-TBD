'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface StepActionsProps {
  step: number;
  loading?: boolean;
  submitLabel?: string;
  disabled?: boolean;
}

export function StepActions({ step, loading, submitLabel = 'Continue', disabled }: StepActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {step > 1 ? (
        <Button type="button" variant="ghost" asChild>
          <Link href={`/onboarding/${step - 1}`}>Back</Link>
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" loading={loading} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
