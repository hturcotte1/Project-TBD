'use client';

import type { TimelineEntryDto } from '@tbd/shared/api';
import { localDate } from '@tbd/shared/time';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MONTH_LABELS, buildCalendarMonth, shiftMonth } from '@/components/timeline/calendar';
import { TIMELINE_KIND_DOT_CLASS } from '@/components/timeline/kind-meta';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_DOTS_PER_DAY = 4;

function entryHref(entry: TimelineEntryDto): string | null {
  if (entry.application_id) return `/schools/${entry.application_id}`;
  return null;
}

export function MonthCalendar({ entries, timezone }: { entries: TimelineEntryDto[]; timezone: string }) {
  const now = useMemo(() => new Date(), []);
  const todayIso = localDate(now, timezone);
  const todayYearMonth = { year: Number(todayIso.slice(0, 4)), month: Number(todayIso.slice(5, 7)) };

  const [cursor, setCursor] = useState(todayYearMonth);
  const [selectedIso, setSelectedIso] = useState<string | null>(todayIso);

  const grid = useMemo(() => buildCalendarMonth(entries, cursor.year, cursor.month, todayIso), [entries, cursor, todayIso]);
  const selectedDay = grid.weeks.flat().find((d) => d.iso === selectedIso) ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {MONTH_LABELS[cursor.month - 1]} {cursor.year}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCursor(todayYearMonth)}>
            Today
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.weeks.flat().map((day) => (
          <button
            key={day.iso}
            type="button"
            onClick={() => setSelectedIso(day.iso)}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors',
              day.inMonth ? 'text-foreground' : 'text-muted-foreground/50',
              day.isToday ? 'font-semibold ring-1 ring-inset ring-primary' : '',
              selectedIso === day.iso ? 'bg-primary/10' : 'hover:bg-accent',
            )}
          >
            <span>{day.day}</span>
            {day.entries.length > 0 ? (
              <span className="flex items-center gap-0.5">
                {day.entries.slice(0, MAX_DOTS_PER_DAY).map((entry, index) => (
                  <span key={`${entry.title}-${index}`} className={cn('h-1 w-1 rounded-full', TIMELINE_KIND_DOT_CLASS[entry.kind])} />
                ))}
              </span>
            ) : (
              <span className="h-1" />
            )}
          </button>
        ))}
      </div>

      {selectedDay ? (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">{formatDate(selectedDay.iso, timezone)}</p>
          {selectedDay.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due this day.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedDay.entries.map((entry, index) => {
                const href = entryHref(entry);
                const label = (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TIMELINE_KIND_DOT_CLASS[entry.kind])} />
                    <span className="min-w-0 truncate">
                      {entry.title}
                      {entry.school_name ? <span className="text-muted-foreground"> — {entry.school_name}</span> : null}
                    </span>
                  </span>
                );
                return <li key={`${entry.title}-${index}`}>{href ? <Link href={href} className="hover:underline">{label}</Link> : label}</li>;
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
