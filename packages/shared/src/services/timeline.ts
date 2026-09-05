/**
 * The student's full deadline timeline (application deadlines, item due dates, aid deadlines,
 * custom items) and its iCalendar export.
 */
import { inArray } from 'drizzle-orm';
import ical from 'ical-generator';
import * as S from '../db/schema';
import type { StudentDb } from '../db/repos/scoped';
import type { ItemKind, ItemStatus } from '../domain/enums';
import { calendarDaysBetween } from '../prioritize';
import type { IsoDate } from '../schemas/common';

export type TimelineEntryKind = 'application_deadline' | 'item_due' | 'aid_deadline' | 'custom';

export interface TimelineEntry {
  date: IsoDate;
  daysRemaining: number;
  title: string;
  kind: TimelineEntryKind;
  applicationId: string | null;
  applicationItemId: string | null;
  schoolName: string | null;
  status: ItemStatus | null;
}

const AID_KINDS = new Set<ItemKind>(['fafsa', 'css_profile']);

export interface BuildTimelineOptions {
  today: IsoDate;
}

/** Every deadline across a student's schools, sorted by date. */
export async function buildTimeline(sdb: StudentDb, opts: BuildTimelineOptions): Promise<TimelineEntry[]> {
  const [applications, items] = await Promise.all([sdb.select(S.applications), sdb.select(S.applicationItems)]);
  const schoolIds = [...new Set(applications.map((a) => a.schoolId))];
  const schools = schoolIds.length ? await sdb.db.select().from(S.schools).where(inArray(S.schools.id, schoolIds)) : [];
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
  const applicationById = new Map(applications.map((a) => [a.id, a]));

  const entries: TimelineEntry[] = [];

  for (const a of applications) {
    const schoolName = schoolNameById.get(a.schoolId) ?? null;
    entries.push({
      date: a.deadline,
      daysRemaining: calendarDaysBetween(opts.today, a.deadline),
      title: `${schoolName ?? 'Application'} deadline`,
      kind: 'application_deadline',
      applicationId: a.id,
      applicationItemId: null,
      schoolName,
      status: null,
    });
  }

  for (const item of items) {
    if (!item.dueDate) continue;
    const application = item.applicationId ? applicationById.get(item.applicationId) : undefined;
    const schoolName = application ? (schoolNameById.get(application.schoolId) ?? null) : null;
    const kind: TimelineEntryKind = AID_KINDS.has(item.kind) ? 'aid_deadline' : item.source === 'student' ? 'custom' : 'item_due';
    entries.push({
      date: item.dueDate,
      daysRemaining: calendarDaysBetween(opts.today, item.dueDate),
      title: item.title,
      kind,
      applicationId: item.applicationId,
      applicationItemId: item.id,
      schoolName,
      status: item.status,
    });
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title)));
  return entries;
}

export interface BuildIcsOptions {
  calendarName: string;
}

/** iCalendar export of a timeline: one all-day event per entry, with a UID stable per entity. */
export function buildIcs(entries: TimelineEntry[], opts: BuildIcsOptions): string {
  const cal = ical({ name: opts.calendarName });
  for (const entry of entries) {
    const uid = entry.applicationItemId
      ? `item-${entry.applicationItemId}@apogee`
      : entry.applicationId
        ? `application-${entry.applicationId}@apogee`
        : `custom-${entry.kind}-${entry.date}-${entry.title.replace(/[^a-z0-9]+/gi, '-')}@apogee`;
    cal.createEvent({
      id: uid,
      start: entry.date,
      allDay: true,
      summary: entry.title,
      description: entry.schoolName ?? undefined,
    });
  }
  return cal.toString();
}
