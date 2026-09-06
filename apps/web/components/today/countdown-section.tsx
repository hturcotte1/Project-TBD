import type { ApplicationDto, OverviewDto } from '@apogee/shared/api';
import { Countdown, Empty } from '@/components/system';
import { buildThenSentence, getFollowingDeadlines } from './next-deadlines';
import { PLAN_LABELS } from './plan-labels';

export interface CountdownSectionProps {
  overview: OverviewDto;
  applications: ApplicationDto[];
}

/** The hero: the days-remaining numeral, the sentence beneath it, and (when there's a second and
 * third deadline coming up) the "Then X in N and Y in M." line. */
export function CountdownSection({ overview, applications }: CountdownSectionProps) {
  const nearest = overview.nearest_deadline;

  if (!nearest) {
    return <Empty sentence="Add a school to start the countdown." action={{ label: 'Add a school', href: '/schools' }} />;
  }

  const verb = nearest.days_remaining < 0 ? 'past' : 'until';
  const label = `days ${verb} ${nearest.school_name}, ${PLAN_LABELS[nearest.plan]}.`;
  const thenSentence = buildThenSentence(getFollowingDeadlines(applications));

  return (
    <div>
      <Countdown size="page" settle days={nearest.days_remaining} label={label} />
      {thenSentence ? <p className="text-14 text-fg-2">{thenSentence}</p> : null}
    </div>
  );
}
