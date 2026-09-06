'use client';

import { CaretDown } from '@phosphor-icons/react';
import { humanizeAuditAction, redactDetails } from '@/components/activity/audit-utils';
import type { StreamItem } from '@/components/activity/stream';
import { rowTimeLabel } from '@/components/activity/stream';
import { TableCell, TableExpansion, TableRow, TextLink } from '@/components/system';
import { cn } from '@/lib/utils';

/** `details.school_name` shows up on plenty of audit actions (sync, fill, message) — read once
 * here rather than at every call site. */
function schoolNameFromDetails(details: Record<string, unknown>): string | null {
  const value = details.school_name;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function ActivityRow({ item, timezone, expanded, onToggle }: { item: StreamItem; timezone: string; expanded: boolean; onToggle: () => void }) {
  const time = rowTimeLabel(item.created_at, timezone);

  if (item.kind === 'change') {
    return (
      <TableRow>
        <TableCell className="w-[88px] text-fg-3 tabular-nums">{time}</TableCell>
        <TableCell colSpan={2}>
          {item.summary}
          {item.schoolName ? <span className="text-fg-2"> {item.schoolName}</span> : null}
        </TableCell>
      </TableRow>
    );
  }

  const details = redactDetails(item.details);
  const schoolName = schoolNameFromDetails(item.details);
  const hasExpansion = details.length > 0 || item.entity_id !== null || item.replay_url !== null;

  return (
    <>
      <TableRow interactive={hasExpansion} expanded={hasExpansion ? expanded : undefined} onClick={hasExpansion ? onToggle : undefined}>
        <TableCell className="w-[88px] text-fg-3 tabular-nums">{time}</TableCell>
        <TableCell>
          {humanizeAuditAction(item.action)}
          {schoolName ? <span className="text-fg-2"> {schoolName}</span> : null}
        </TableCell>
        <TableCell className="w-8">{hasExpansion ? <CaretDown className={cn('transition-transform duration-fast ease-out', expanded && 'rotate-180')} /> : null}</TableCell>
      </TableRow>
      {hasExpansion && expanded ? (
        <TableExpansion colSpan={3}>
          <div className="flex flex-col gap-3">
            {details.length > 0 ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-12 sm:grid-cols-2">
                {details.map((detail) => (
                  <div key={detail.key} className="flex gap-1.5">
                    <dt className="shrink-0 text-fg-2">{detail.key}</dt>
                    <dd className="truncate text-fg">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {item.entity_id ? <p className="font-mono text-12 text-fg-3">{item.entity_id}</p> : null}
            {item.replay_url ? (
              <TextLink href={item.replay_url} target="_blank" rel="noopener noreferrer" className="w-fit text-12">
                Replay
              </TextLink>
            ) : null}
          </div>
        </TableExpansion>
      ) : null}
    </>
  );
}
