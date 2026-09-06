import type { OverviewDto } from '@apogee/shared/api';
import type { StateChange } from '@apogee/shared/schemas';
import { ErrorNote, Section, TextLink } from '@/components/system';
import { relativeTimeFromNow } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The school's name only opens the sentence when the summary doesn't already read that way — a
 * change like "Common App marked your Purdue transcript as received." already carries its own
 * subject and would otherwise get a redundant prefix. */
function changeSentence(change: StateChange): string {
  if (!change.school_name) return change.summary;
  if (change.summary.toLowerCase().includes(change.school_name.toLowerCase())) return change.summary;
  return `${change.school_name} ${change.summary}`;
}

export interface SinceYesterdayProps {
  overview: OverviewDto;
}

export function SinceYesterday({ overview }: SinceYesterdayProps) {
  const changes = overview.changes_since_yesterday;

  return (
    <Section title="Since yesterday">
      <div className="flex flex-col gap-3">
        {overview.sync_paused_reason ? (
          <ErrorNote>
            {overview.sync_paused_reason} <TextLink href="/settings">Check settings</TextLink>
          </ErrorNote>
        ) : null}

        {changes.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-14 text-fg-2">Nothing changed on Common App since the last sync.</p>
            <p className="text-12 text-fg-3">{overview.last_synced_at ? `Last synced ${relativeTimeFromNow(overview.last_synced_at)}` : 'Not synced yet'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {changes.map((change, index) => (
              <p key={`${change.path}-${index}`} className={cn('text-14', change.significance === 'important' ? 'font-medium text-fg' : 'text-fg-2')}>
                {changeSentence(change)}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
