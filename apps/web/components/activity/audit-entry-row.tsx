import type { AuditEntryDto } from '@apogee/shared/api';
import type { AuditActor } from '@apogee/shared/domain';
import { Bot, ExternalLink, ServerCog, ShieldCheck, User } from 'lucide-react';
import type { ComponentType } from 'react';
import { humanizeAuditAction, redactDetails } from '@/components/activity/audit-utils';
import { Card, CardContent } from '@/components/ui/card';
import { relativeTimeFromNow } from '@/lib/format';

const ACTOR_ICON: Record<AuditActor, ComponentType<{ className?: string }>> = {
  agent: Bot,
  student: User,
  system: ServerCog,
  admin: ShieldCheck,
};

const ACTOR_LABEL: Record<AuditActor, string> = {
  agent: 'Agent',
  student: 'You',
  system: 'System',
  admin: 'Admin',
};

export function AuditEntryRow({ entry }: { entry: AuditEntryDto }) {
  const Icon = ACTOR_ICON[entry.actor];
  const details = redactDetails(entry.details);

  return (
    <Card>
      <CardContent className="flex gap-3 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-medium">{humanizeAuditAction(entry.action)}</p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {ACTOR_LABEL[entry.actor]} · {relativeTimeFromNow(entry.created_at)}
            </span>
          </div>
          {details.length > 0 ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.key} className="flex gap-1.5 truncate">
                  <dt className="shrink-0 font-medium text-foreground/70">{detail.key}:</dt>
                  <dd className="truncate">{detail.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {entry.replay_url ? (
            <a
              href={entry.replay_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Replay <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
