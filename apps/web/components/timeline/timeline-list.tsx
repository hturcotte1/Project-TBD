import type { TimelineEntryDto } from '@apogee/shared/api';
import Link from 'next/link';
import { groupEntriesByMonth } from '@/components/timeline/calendar';
import { TIMELINE_KIND_DOT_CLASS, TIMELINE_KIND_LABELS } from '@/components/timeline/kind-meta';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { cn } from '@/lib/utils';

function entryHref(entry: TimelineEntryDto): string | null {
  return entry.application_id ? `/schools/${entry.application_id}` : null;
}

export function TimelineList({ entries }: { entries: TimelineEntryDto[] }) {
  const groups = groupEntriesByMonth(entries);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={`${group.year}-${group.month}`} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="space-y-2">
            {group.entries.map((entry, index) => {
              const href = entryHref(entry);
              const row = (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', TIMELINE_KIND_DOT_CLASS[entry.kind])} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.school_name ?? TIMELINE_KIND_LABELS[entry.kind]}
                      </p>
                    </div>
                  </div>
                  <DeadlineBadge daysRemaining={entry.days_remaining} className="shrink-0" />
                </div>
              );
              return (
                <div key={`${entry.title}-${entry.date}-${index}`}>
                  {href ? (
                    <Link href={href} className="block hover:opacity-80">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
