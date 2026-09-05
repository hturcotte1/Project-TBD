import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit, nudgesRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import { IsoDate, IsoDateTime } from '@apogee/shared/schemas';
import { defineTool, fail, ok } from './types';
import { bestMatch, matchItem, matchesSchool } from './util';

export const MarkItemDoneInput = z.object({ query: z.string().min(1).max(300) });

export const markItemDoneTool = defineTool({
  name: 'markItemDone',
  description: 'Mark an open application item done by fuzzy title match (e.g. "the Georgetown supp").',
  inputSchema: MarkItemDoneInput,
  authorization: 'student_text',
  async run(tc, input) {
    const items = await tc.sdb.select(S.applicationItems, undefined, { orderBy: asc(S.applicationItems.importance) });
    const schoolNameByAppId = new Map(tc.ctx.applications.map((v) => [v.application.id, v.school.name]));
    const openItems = items.filter((i) => i.status !== 'done' && i.status !== 'not_applicable');
    const outcome = matchItem(
      input.query,
      openItems.map((i) => ({ id: i.id, title: i.title, kind: i.kind, schoolName: i.applicationId ? (schoolNameByAppId.get(i.applicationId) ?? null) : null, row: i })),
    );
    if (outcome.kind === 'none') return fail(`I couldn't find an open item matching "${input.query}".`);
    if (outcome.kind === 'ambiguous') {
      const names = outcome.candidates.map((c) => `${c.title}${c.schoolName ? ` (${c.schoolName})` : ''}`).join(' or ');
      return fail(`Which one did you finish: ${names}?`);
    }
    const match = outcome.item.row;
    const [updated] = await tc.sdb.update(S.applicationItems, { status: 'done', completedAt: tc.deps.clock.now(), studentEdited: true }, eq(S.applicationItems.id, match.id));
    if (!updated) return fail('Could not update that item.');
    await nudgesRepo.acknowledgeForItem(tc.sdb, match.id);
    await tc.sdb.update(S.nextActions, { status: 'done' }, eq(S.nextActions.applicationItemId, match.id));
    await appendAudit(tc.sdb, { actor: 'agent', action: 'item.marked_done', entityType: 'application_item', entityId: match.id, details: { title: match.title } });
    const school = match.applicationId ? schoolNameByAppId.get(match.applicationId) : undefined;
    return ok({ itemId: match.id, title: match.title, school: school ?? null, kind: match.kind }, `Marked "${match.title}"${school ? ` for ${school}` : ''} done.`);
  },
});

export const SnoozeItemInput = z.object({ query: z.string().min(1).max(300), until: IsoDateTime });

export const snoozeItemTool = defineTool({
  name: 'snoozeItem',
  description: 'Stop proactive nudges about one item until a given time.',
  inputSchema: SnoozeItemInput,
  authorization: 'student_text',
  async run(tc, input) {
    const items = await tc.sdb.select(S.applicationItems);
    const match = bestMatch(input.query, items, (i) => i.title);
    if (!match) return fail(`I couldn't find an item matching "${input.query}".`);
    const until = new Date(input.until);
    await nudgesRepo.snoozeForItem(tc.sdb, match.id, until);
    await appendAudit(tc.sdb, { actor: 'agent', action: 'item.snoozed', entityType: 'application_item', entityId: match.id, details: { until: until.toISOString() } });
    return ok({ itemId: match.id, until: until.toISOString() }, `Won't bring up "${match.title}" again until ${until.toISOString().slice(0, 10)}.`);
  },
});

export const AddCustomItemInput = z.object({ title: z.string().min(1).max(200), school: z.string().min(1).max(200).optional(), due_date: IsoDate.optional() });

export const addCustomItemTool = defineTool({
  name: 'addCustomItem',
  description: 'Add a custom to-do item, optionally tied to a school and a due date.',
  inputSchema: AddCustomItemInput,
  authorization: 'student_text',
  async run(tc, input) {
    let applicationId: string | null = null;
    let schoolName: string | null = null;
    if (input.school) {
      const match = tc.ctx.applications.find((v) => matchesSchool(input.school as string, v.school));
      if (match) {
        applicationId = match.application.id;
        schoolName = match.school.name;
      }
    }
    const [row] = await tc.sdb.insert(S.applicationItems, {
      applicationId,
      ruleKey: `custom:${randomUUID()}`,
      kind: 'custom',
      title: input.title,
      description: '',
      source: 'student',
      status: 'missing',
      dueDate: input.due_date ?? null,
      importance: 50,
      effort: 'medium',
      dependsOnOthers: false,
      blocking: false,
      studentEdited: true,
    });
    if (!row) return fail('Could not add that item.');
    await appendAudit(tc.sdb, { actor: 'agent', action: 'item.custom_added', entityType: 'application_item', entityId: row.id, details: { title: input.title } });
    return ok({ itemId: row.id }, `Added "${input.title}"${schoolName ? ` for ${schoolName}` : ''}${input.due_date ? ` due ${input.due_date}` : ''} to your list.`);
  },
});
