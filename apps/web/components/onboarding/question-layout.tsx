'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/system';
import { cn } from '@/lib/utils';

export interface QuestionLayoutProps {
  /** The h1, phrased as a question. */
  question: ReactNode;
  /** An optional one-sentence secondary line under the question. */
  context?: ReactNode;
  /** A `<WhyWeAsk>` element, rendered under the control. Not wrapped further here — `WhyWeAsk`
   * already renders the one allowed line. */
  whyWeAsk?: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack?: () => void;
  /** Hides Back entirely — only true on the very first question of the whole flow. */
  backHidden?: boolean;
  continueLabel?: string;
  continueLoading?: boolean;
  continueDisabled?: boolean;
  /** An extra action next to Continue, e.g. "Skip for now" or "I'm test-optional". */
  footerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The chrome every onboarding question shares: a question, an optional sentence of context, the
 * control, a one-line why-we-ask, and a Back/Continue footer. `components/onboarding/*` step
 * components own the actual fields; this only supplies the shape DESIGN.md and the spec fix for
 * every screen.
 */
export function QuestionLayout({
  question,
  context,
  whyWeAsk,
  onSubmit,
  onBack,
  backHidden = false,
  continueLabel = 'Continue',
  continueLoading = false,
  continueDisabled = false,
  footerExtra,
  children,
  className,
}: QuestionLayoutProps) {
  return (
    <form className={cn('flex flex-col gap-6', className)} onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-2">
        <h1 className="text-22 font-semibold lg:text-28">{question}</h1>
        {context ? <p className="text-14 text-fg-2">{context}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
      {whyWeAsk}
      <div className="flex items-center justify-between gap-4 pt-2">
        {!backHidden ? (
          <Button type="button" variant="quiet" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {footerExtra}
          <Button type="submit" variant="primary" loading={continueLoading} disabled={continueDisabled}>
            {continueLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
