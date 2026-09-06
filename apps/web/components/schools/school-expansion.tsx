import type { ApplicationDto, ApplicationItemDto } from '@apogee/shared/api';
import { daysUntil } from '@apogee/shared/time';
import { AddItemInput } from '@/components/schools/add-item-input';
import { completionGroups } from '@/components/schools/completion';
import { openChecklistItems } from '@/components/schools/sort';
import { SyncNowButton } from '@/components/schools/sync-now-button';
import { Button, DaysFigure, TextLink } from '@/components/system';
import { relativeTimeFromNow } from '@/lib/format';

/** The Schools table's inline row detail: per-group progress, the top open items, a quick-add
 * field, and the same actions available from the school detail page. */
export function SchoolExpansion({ application, items, timezone, now = new Date() }: { application: ApplicationDto; items: ApplicationItemDto[]; timezone: string; now?: Date }) {
  const groups = completionGroups(items);
  const openItems = openChecklistItems(items, 5);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <div key={group.label} className="flex items-baseline justify-between gap-2 text-14">
              <span className="text-fg">{group.label}</span>
              <span className="tabular-nums text-fg-2">
                {group.done} of {group.total}
              </span>
            </div>
          ))}
        </div>

        {openItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {openItems.map((item) => {
              const daysRemaining = item.due_date ? daysUntil(item.due_date, now, timezone) : null;
              return (
                <div key={item.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-14 text-fg">{item.title}</span>
                    {daysRemaining !== null ? <DaysFigure days={daysRemaining} format="relative" /> : null}
                  </div>
                  {item.evidence ? (
                    <p className="text-12 text-fg-3">
                      Seen on Common App {relativeTimeFromNow(item.evidence.seen_at, now)}: {item.evidence.text}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <AddItemInput applicationId={application.id} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-4 lg:flex-col lg:items-start">
        <TextLink href={`/schools/${application.id}`}>Open school</TextLink>
        {application.common_app_url ? (
          <Button variant="text" className="h-auto px-0" asChild>
            <a href={application.common_app_url} target="_blank" rel="noreferrer noopener">
              Open in Common App
            </a>
          </Button>
        ) : null}
        <SyncNowButton variant="quiet" className="h-auto px-0" />
      </div>
    </div>
  );
}
