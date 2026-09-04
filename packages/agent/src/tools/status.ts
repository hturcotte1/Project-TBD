import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as S from '@tbd/shared/db/schema';
import { findSchool } from '../integrations/shared-engines';
import { defineTool, fail, ok } from './types';
import { matchesSchool } from './util';

export const GetApplicationStatusInput = z.object({ school: z.string().min(1).max(200).optional() });

export const getApplicationStatusTool = defineTool({
  name: 'getApplicationStatus',
  description: "Get the current status of one school's application (or all schools, if none is named): items, statuses, deadline, days remaining.",
  inputSchema: GetApplicationStatusInput,
  authorization: 'any',
  async run(tc, input) {
    const views = input.school ? tc.ctx.applications.filter((v) => matchesSchool(input.school as string, v.school)) : tc.ctx.applications;
    if (views.length === 0) {
      return fail(input.school ? `I don't see an application for "${input.school}" on your list.` : 'No applications on your list yet.');
    }
    const data: Array<{ school: string; plan: string; deadline: string; daysRemaining: number | null; items: Array<{ title: string; status: string }> }> = [];
    const parts: string[] = [];
    for (const v of views) {
      const items = await tc.sdb.select(S.applicationItems, eq(S.applicationItems.applicationId, v.application.id), { orderBy: asc(S.applicationItems.importance) });
      const open = items.filter((i) => i.status !== 'done' && i.status !== 'not_applicable');
      data.push({
        school: v.school.name,
        plan: v.application.plan,
        deadline: v.application.deadline,
        daysRemaining: v.daysRemaining,
        items: items.map((i) => ({ title: i.title, status: i.status })),
      });
      parts.push(
        `${v.school.name} (${v.application.plan}, due ${v.application.deadline}, ${v.daysRemaining}d): ${open.length} open item${open.length === 1 ? '' : 's'}${
          open.length ? ` — ${open.slice(0, 4).map((i) => i.title).join(', ')}` : ''
        }.`,
      );
    }
    return ok(data, parts.join(' '));
  },
});

export const ListNextActionsInput = z.object({ limit: z.number().int().min(1).max(25).optional() });

export const listNextActionsTool = defineTool({
  name: 'listNextActions',
  description: "List the student's current open next actions, ranked.",
  inputSchema: ListNextActionsInput,
  authorization: 'any',
  async run(tc, input) {
    const limit = input.limit ?? 5;
    const actions = tc.ctx.openNextActions.slice(0, limit);
    if (actions.length === 0) return ok([], "Nothing open on your next-actions list right now — you're all caught up.");
    const summary = actions.map((a) => `${a.action}${a.dueDate ? ` (due ${a.dueDate})` : ''}`).join('; ');
    return ok(
      actions.map((a) => ({ id: a.id, action: a.action, reason: a.reason, dueDate: a.dueDate })),
      summary,
    );
  },
});

export const ExplainRequirementInput = z.object({ school: z.string().min(1).max(200), topic: z.string().min(1).max(200) });

export const explainRequirementTool = defineTool({
  name: 'explainRequirement',
  description: "Explain one school's requirement (recommendations, supplements, testing, fee, deadline, interview, portfolio) from the requirements dataset.",
  inputSchema: ExplainRequirementInput,
  authorization: 'any',
  async run(tc, input) {
    const entry = findSchool(input.school);
    if (!entry) return fail(`I don't have requirements on file for "${input.school}" yet.`);
    const r = entry.requirements;
    const topic = input.topic.toLowerCase();
    let text: string;
    if (/rec/.test(topic)) {
      text = `${entry.name} wants ${r.recommendations.teacher_min} teacher letter${r.recommendations.teacher_min === 1 ? '' : 's'}${r.recommendations.counselor_required ? ' and a counselor letter' : ''}.`;
    } else if (/suppl|essay/.test(topic)) {
      text = r.supplements.length
        ? `${entry.name} supplements: ${r.supplements.map((s) => `${s.title}${s.word_limit ? ` (${s.word_limit}w)` : ''}`).join(', ')}.`
        : `${entry.name} has no supplements beyond the standard Common App questions.`;
    } else if (/test/.test(topic)) {
      text = `${entry.name}'s test policy is ${r.test_policy}.`;
    } else if (/fee/.test(topic)) {
      text = `${entry.name}'s application fee is ${r.application_fee != null ? `$${r.application_fee}` : 'not on file'}${r.fee_waiver_eligible ? ' (fee-waiver eligible)' : ''}.`;
    } else if (/deadline|due/.test(topic)) {
      text = `${entry.name} deadlines: ${r.plans.map((p) => `${p.plan} ${p.deadline}`).join(', ')}.`;
    } else if (/interview/.test(topic)) {
      text = `${entry.name}'s interview policy is ${r.interview_policy}.`;
    } else if (/portfolio/.test(topic)) {
      text = `${entry.name}'s portfolio requirement is ${r.portfolio.status}.`;
    } else {
      text = `${entry.name}: ${r.plans.map((p) => `${p.plan} due ${p.deadline}`).join(', ')}; ${r.recommendations.teacher_min} teacher rec(s)${
        r.recommendations.counselor_required ? ' + counselor' : ''
      }; ${r.supplements.length} supplement(s); test policy ${r.test_policy}.`;
    }
    if (r.needs_verification) text += " (I haven't verified this one on their site yet — worth double-checking.)";
    return ok({ school: entry.slug, topic: input.topic }, text);
  },
});
