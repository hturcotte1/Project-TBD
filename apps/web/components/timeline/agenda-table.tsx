'use client';

import type { TimelineEntryDto } from '@apogee/shared/api';
import { Check } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { formatShortDate, groupEntriesByMonth, type TimelineMonthGroup } from '@/components/timeline/agenda';
import { KIND_WORD_LABELS, timelineStatusInfo } from '@/components/timeline/kind-meta';
import { DaysFigure, Section, Table, TableBody, TableCell, TableRow, TextLink } from '@/components/system';

export interface AgendaTableProps {
  entries: TimelineEntryDto[];
  today: string;
  timezone: string;
  selectedDate: string | null;
  pastExpanded: boolean;
  onExpandPast: () => void;
}

/** The timeline's agenda: one Section per month, in order, each a header-less Table. Past months
 * collapse into a single summary line until clicked open (or until a runway click selects a date
 * inside one, which the page handles by flipping `pastExpanded` itself). */
export function AgendaTable({ entries, today, timezone, selectedDate, pastExpanded, onExpandPast }: AgendaTableProps) {
  const router = useRouter();
  const groups = useMemo(() => groupEntriesByMonth(entries, today), [entries, today]);
  const pastGroups = groups.filter((group) => group.isPast);
  const futureGroups = groups.filter((group) => !group.isPast);
  const pastCount = pastGroups.reduce((sum, group) => sum + group.entries.length, 0);

  function renderGroup(group: TimelineMonthGroup) {
    return (
      <Section key={group.key} title={group.label}>
        <Table>
          <TableBody>
            {group.entries.map((entry, index) => {
              const status = timelineStatusInfo(entry.status);
              const hasApplication = Boolean(entry.application_id);
              return (
                <TableRow
                  key={`${group.key}-${index}`}
                  data-date={entry.date}
                  interactive={hasApplication}
                  selected={selectedDate === entry.date}
                  onClick={hasApplication ? () => router.push(`/schools/${entry.application_id}`) : undefined}
                >
                  <TableCell className="w-[72px] text-fg-2">{formatShortDate(entry.date, timezone)}</TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {status?.tone === 'ok' ? <Check className="shrink-0 text-ok lg:hidden" aria-hidden /> : null}
                      {entry.application_id ? (
                        <TextLink href={`/schools/${entry.application_id}`} onClick={(event) => event.stopPropagation()}>
                          {entry.title}
                        </TextLink>
                      ) : (
                        entry.title
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-fg-2 lg:table-cell">{entry.school_name}</TableCell>
                  <TableCell className="hidden text-fg-3 lg:table-cell">{KIND_WORD_LABELS[entry.kind]}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {status ? <span className={status.tone === 'ok' ? 'text-ok' : 'text-fg-2'}>{status.text}</span> : null}
                  </TableCell>
                  <TableCell numeric>
                    <DaysFigure days={entry.days_remaining} format="number" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {pastGroups.length > 0 ? (
        pastExpanded ? (
          pastGroups.map(renderGroup)
        ) : (
          <button type="button" onClick={onExpandPast} className="h-row-touch flex items-center text-14 text-fg-2 hover:text-fg lg:h-row">
            {pastCount} past {pastCount === 1 ? 'deadline' : 'deadlines'}
          </button>
        )
      ) : null}
      {futureGroups.map(renderGroup)}
    </div>
  );
}
