import { AuthorizationError, studentsRepo } from '@tbd/shared/db';
import * as D from '@tbd/shared/api';
import { buildIcs, buildTimeline, type TimelineEntry } from '@tbd/shared/services';
import { localDate } from '@tbd/shared/time';
import { authed, type Handlers } from './contract';

function toDto(entry: TimelineEntry): D.TimelineEntryDto {
  return {
    date: entry.date,
    days_remaining: entry.daysRemaining,
    title: entry.title,
    kind: entry.kind,
    application_id: entry.applicationId,
    application_item_id: entry.applicationItemId,
    school_name: entry.schoolName,
    status: entry.status,
  };
}

export const timelineHandlers: Pick<Handlers, 'timeline' | 'timelineIcs'> = {
  timeline: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const entries = await buildTimeline(sdb, { today: localDate(deps.clock.now(), student.timezone) });
    return entries.map(toDto);
  }),

  timelineIcs: authed(async ({ auth, sdb, deps }) => {
    const student = await studentsRepo.findById(deps.db, auth.studentId);
    if (!student) throw new AuthorizationError();
    const entries = await buildTimeline(sdb, { today: localDate(deps.clock.now(), student.timezone) });
    const name = [student.preferredName, student.lastName].filter(Boolean).join(' ') || 'Student';
    return buildIcs(entries, { calendarName: `${name} — college applications` });
  }),
};
