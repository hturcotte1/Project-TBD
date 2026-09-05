import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { IsoDateTime } from '@tbd/shared/schemas';
import { nextQuietHoursEnd } from '@tbd/shared/time';
import { defineTool, ok } from './types';

export const SendDashboardLinkInput = z.object({ page: z.string().min(1).max(100).optional() });

export const sendDashboardLinkTool = defineTool({
  name: 'sendDashboardLink',
  description: "Send the student a link to their dashboard (optionally a specific page).",
  inputSchema: SendDashboardLinkInput,
  authorization: 'any',
  async run(tc, input) {
    const base = tc.deps.env.APP_URL.replace(/\/$/, '');
    const url = `${base}/dashboard${input.page ? `/${input.page.replace(/^\//, '')}` : ''}`;
    return ok({ url }, `Here's your dashboard: ${url}`);
  },
});

export const SetQuietHoursInput = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) });

export const setQuietHoursTool = defineTool({
  name: 'setQuietHours',
  description: 'Change the window during which proactive texts are allowed to send.',
  inputSchema: SetQuietHoursInput,
  authorization: 'student_text',
  async run(tc, input) {
    await tc.deps.db.update(S.students).set({ quietHoursStart: input.start, quietHoursEnd: input.end }).where(eq(S.students.id, tc.studentId));
    await appendAudit(tc.sdb, { actor: 'agent', action: 'quiet_hours.updated', details: { start: input.start, end: input.end } });
    return ok({ start: input.start, end: input.end }, `Quiet hours set to ${input.start}–${input.end}.`);
  },
});

export const SnoozeNotificationsInput = z.object({
  /** An ISO instant, or "tomorrow_morning" = when the student's quiet hours next end (default 7am local). */
  until: z.union([IsoDateTime, z.literal('tomorrow_morning')]),
});

export const snoozeNotificationsTool = defineTool({
  name: 'snoozeNotifications',
  description: 'Pause all proactive texts until a given time (e.g. tomorrow morning).',
  inputSchema: SnoozeNotificationsInput,
  authorization: 'student_text',
  async run(tc, input) {
    const until =
      input.until === 'tomorrow_morning'
        ? nextQuietHoursEnd(tc.deps.clock.now(), tc.ctx.student.timezone, { start: tc.ctx.student.quietHoursStart, end: tc.ctx.student.quietHoursEnd })
        : new Date(input.until);
    await tc.deps.db.update(S.students).set({ snoozedUntil: until }).where(eq(S.students.id, tc.studentId));
    await appendAudit(tc.sdb, { actor: 'agent', action: 'notifications.snoozed', details: { until: until.toISOString() } });
    return ok({ until: until.toISOString() }, "Okay, I'll leave you alone until then.");
  },
});
