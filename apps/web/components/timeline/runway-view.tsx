'use client';

import type { TimelineEntryDto } from '@apogee/shared/api';
import { useEffect, useRef, useState } from 'react';
import { formatShortDate } from '@/components/timeline/agenda';
import { layoutRunway } from '@/components/timeline/runway';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/system';
import { cn } from '@/lib/utils';

const DESKTOP_PX_PER_DAY = 12;
const MOBILE_PX_PER_DAY = 8;
/** Tallest a tick can get (deadline height + full stack) plus a little breathing room. */
const TICK_AREA_HEIGHT = 40;
const LABEL_ROW_HEIGHT = 20;
/** A label centered over day 0 (or the last day) would otherwise have half its text clipped by
 * the container's edge — this reserves room on both sides so "Today" and the last month label
 * always have somewhere to overflow into. */
const SIDE_PADDING = 28;

export interface RunwayViewProps {
  entries: TimelineEntryDto[];
  today: string;
  timezone: string;
  onSelectDate: (date: string) => void;
}

function tickLabel(entry: TimelineEntryDto, timezone: string): string {
  const date = formatShortDate(entry.date, timezone);
  return entry.school_name && !entry.title.includes(entry.school_name) ? `${entry.title}, ${entry.school_name}, ${date}` : `${entry.title}, ${date}`;
}

/** The runway: a horizontal, scrollable day axis from the earliest date in play to the latest,
 * with a tick per entry, colored by urgency. Geometry comes from the pure `layoutRunway` helper;
 * this component only measures its own width and picks the day scale for the viewport. */
export function RunwayView({ entries, today, timezone, onSelectDate }: RunwayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let query: MediaQueryList;
    try {
      query = window.matchMedia('(min-width: 1024px)');
    } catch {
      return;
    }
    setIsDesktop(query.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const pxPerDay = isDesktop ? DESKTOP_PX_PER_DAY : MOBILE_PX_PER_DAY;
  const layout = layoutRunway(entries, today, pxPerDay, Math.max(0, containerWidth - SIDE_PADDING * 2));
  const height = LABEL_ROW_HEIGHT + TICK_AREA_HEIGHT;
  const left = (x: number) => x + SIDE_PADDING;

  return (
    <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
      <div className="relative" style={{ width: layout.width + SIDE_PADDING * 2, minWidth: '100%', height }}>
        <div className="absolute inset-x-0 top-0" style={{ height: LABEL_ROW_HEIGHT }}>
          {layout.months.map((month) => (
            <span
              key={`${month.x}-${month.label}`}
              style={{ left: left(month.x) }}
              className="absolute -translate-x-1/2 whitespace-nowrap text-12 text-fg-2"
            >
              {month.label}
            </span>
          ))}
          <span style={{ left: left(layout.todayX) }} className="absolute -translate-x-1/2 whitespace-nowrap text-12 text-brand">
            Today
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0" style={{ height: TICK_AREA_HEIGHT }}>
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />

          {layout.months.map((month) => (
            <span key={`${month.x}-tick`} style={{ left: left(month.x) }} className="absolute bottom-0 h-2 w-px -translate-x-1/2 bg-line-strong" />
          ))}

          <span style={{ left: left(layout.todayX) }} className="absolute bottom-0 h-4 w-0.5 -translate-x-1/2 bg-brand" />

          {/* Each button's hit area is the full tick-area height (meeting the 40px touch minimum
              vertically) but only one day wide, so adjacent-day ticks each keep their own
              territory rather than fighting over a shared 40px box — a deliberate trade-off for a
              dense day-by-day axis, called out in the area's report. */}
          {layout.ticks.map((tick, index) => {
            const label = tickLabel(tick.entry, timezone);
            return (
              <Tooltip key={`${tick.entry.date}-${index}`}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() => onSelectDate(tick.entry.date)}
                    style={{ left: left(tick.x), width: Math.max(pxPerDay, 8), height: TICK_AREA_HEIGHT }}
                    className="absolute bottom-0 flex -translate-x-1/2 items-end justify-center"
                  >
                    <span style={{ height: tick.height }} className={cn('w-0.5', tick.colorClass)} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
