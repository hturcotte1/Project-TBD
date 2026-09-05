import type { OverviewDto } from '@apogee/shared/api';
import { DeadlineBadge } from '@/components/layout/deadline-badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, relativeDays } from '@/lib/format';

export function DeadlineHero({ overview, timezone }: { overview: OverviewDto; timezone: string }) {
  const nearest = overview.nearest_deadline;

  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Next deadline</p>
          {nearest ? (
            <>
              <p className="text-2xl font-semibold tracking-tight">
                {relativeDays(nearest.days_remaining)} · {nearest.school_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {nearest.plan} — {formatDate(nearest.date, timezone)}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tracking-tight">No schools yet</p>
              <p className="text-sm text-muted-foreground">Add schools to your list to see deadlines here.</p>
            </>
          )}
        </div>
        {nearest ? <DeadlineBadge daysRemaining={nearest.days_remaining} className="px-3 py-1 text-sm" /> : null}
      </CardContent>
      <CardContent className="grid grid-cols-3 gap-4 border-t border-border/60 p-4 pt-4 text-center">
        <Stat label="Schools" value={overview.applications_count} />
        <Stat label="Open items" value={overview.items_open} />
        <Stat label="Done" value={overview.items_done} />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
