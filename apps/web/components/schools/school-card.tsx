import type { ApplicationDto } from '@tbd/shared/api';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { PLAN_LABELS } from '@/components/schools/plan-labels';
import { CompletionRing } from '@/components/layout/completion-ring';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, relativeTimeFromNow } from '@/lib/format';

const STATUS_LABELS: Record<ApplicationDto['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_to_submit: 'Ready to submit',
  submitted: 'Submitted',
  decision_received: 'Decision received',
};

const STATUS_VARIANT: Record<ApplicationDto['status'], 'outline' | 'secondary' | 'success'> = {
  not_started: 'outline',
  in_progress: 'secondary',
  ready_to_submit: 'secondary',
  submitted: 'success',
  decision_received: 'success',
};

export function SchoolCard({ application, timezone }: { application: ApplicationDto; timezone: string }) {
  const externalLink = application.common_app_url ?? (application.school.common_app_member ? null : application.school.portal_url);
  const externalLabel = application.common_app_url ? 'Open in Common App' : 'Open school portal';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <CompletionRing percent={application.completion_percent} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/schools/${application.id}`} className="truncate text-sm font-semibold hover:underline">
                {application.school.name}
              </Link>
              <Badge variant="outline">{PLAN_LABELS[application.plan]}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <DeadlineBadge daysRemaining={application.days_remaining} label={formatDate(application.deadline, timezone)} />
              <Badge variant={STATUS_VARIANT[application.status]}>{STATUS_LABELS[application.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {application.counts.done}/{application.counts.total} done
              {application.counts.blocked > 0 ? ` · ${application.counts.blocked} blocked` : ''}
              {' · '}
              {application.last_synced_at ? `synced ${relativeTimeFromNow(application.last_synced_at)}` : 'never synced'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          {externalLink ? (
            <a
              href={externalLink}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {externalLabel} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
