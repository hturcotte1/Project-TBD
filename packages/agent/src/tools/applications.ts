import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { APPLICATION_PLANS, type ApplicationPlan } from '@tbd/shared/domain';
import type { SchoolRequirementsData } from '@tbd/shared/schemas';
import { buildChecklist, findSchool, resolveDeadline } from '../integrations/shared-engines';
import { defineTool, fail, ok } from './types';

export const AddApplicationInput = z.object({ school: z.string().min(1).max(200), plan: z.enum(APPLICATION_PLANS).optional() });

const UNVERIFIED_CYCLE = '2026-27';

function unverifiedRequirements(): SchoolRequirementsData {
  return {
    cycle: UNVERIFIED_CYCLE,
    plans: [{ plan: 'RD', deadline: '2027-01-01', notes: 'Placeholder deadline — not yet verified.', needs_verification: true }],
    supplements: [],
    recommendations: { teacher_min: 1, teacher_max: 2, counselor_required: true, other_max: 0, notes: '' },
    test_policy: 'optional',
    interview_policy: 'none',
    portfolio: { status: 'none', description: '' },
    midyear_report: true,
    css_profile: { required: false, deadline: null, needs_verification: false },
    fafsa_priority_deadline: null,
    application_fee: null,
    fee_waiver_eligible: true,
    needs_verification: true,
    source: 'internal_dataset',
    notes: 'Added by the student; requirements not yet verified.',
  };
}

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return s || `school-${randomUUID().slice(0, 8)}`;
}

export const addApplicationTool = defineTool({
  name: 'addApplication',
  description: "Add a school to the student's application list, seeding its requirements and checklist.",
  inputSchema: AddApplicationInput,
  authorization: 'student_text',
  async run(tc, input) {
    const entry = findSchool(input.school);
    const db = tc.deps.db;

    let schoolId: string;
    let schoolName: string;
    let requirementsData: SchoolRequirementsData;
    let needsVerification: boolean;

    if (entry) {
      const existing = await db.select().from(S.schools).where(eq(S.schools.slug, entry.slug)).limit(1);
      let row = existing[0];
      if (!row) {
        const [created] = await db
          .insert(S.schools)
          .values({
            slug: entry.slug,
            name: entry.name,
            ceebCode: entry.ceeb_code,
            commonAppMember: entry.common_app_member,
            portalUrl: entry.portal_url,
            website: entry.website,
            city: entry.city,
            state: entry.state,
            type: entry.type,
            aliases: entry.aliases,
          })
          .returning();
        row = created;
      }
      if (!row) return fail('Could not create that school.');
      schoolId = row.id;
      schoolName = row.name;
      requirementsData = entry.requirements;
      needsVerification = entry.requirements.needs_verification;
      const existingReq = await db
        .select()
        .from(S.schoolRequirements)
        .where(and(eq(S.schoolRequirements.schoolId, schoolId), eq(S.schoolRequirements.cycle, entry.requirements.cycle)))
        .limit(1);
      if (!existingReq[0]) {
        await db.insert(S.schoolRequirements).values({ schoolId, cycle: entry.requirements.cycle, data: entry.requirements, needsVerification: entry.requirements.needs_verification });
      }
    } else {
      schoolName = input.school.trim();
      requirementsData = unverifiedRequirements();
      needsVerification = true;
      const [created] = await db
        .insert(S.schools)
        .values({ slug: slugify(schoolName), name: schoolName, commonAppMember: true, city: '', state: '', type: 'private', aliases: [] })
        .returning();
      if (!created) return fail('Could not create that school.');
      schoolId = created.id;
      await db.insert(S.schoolRequirements).values({ schoolId, cycle: requirementsData.cycle, data: requirementsData, needsVerification: true });
    }

    const existingApp = await tc.sdb.selectOne(S.applications, eq(S.applications.schoolId, schoolId));
    if (existingApp) return fail(`${schoolName} is already on your list.`);

    const requestedPlan: ApplicationPlan | undefined = input.plan;
    const resolvedPlan: ApplicationPlan =
      requestedPlan && requirementsData.plans.some((p) => p.plan === requestedPlan) ? requestedPlan : (requirementsData.plans[0]?.plan ?? 'RD');
    const resolved = resolveDeadline(requirementsData, resolvedPlan);
    const deadline = resolved?.deadline ?? '2027-01-01';

    const [application] = await tc.sdb.insert(S.applications, {
      schoolId,
      plan: resolvedPlan,
      deadline,
      deadlineSource: entry ? 'internal_dataset' : 'student',
      status: 'not_started',
    });
    if (!application) return fail('Could not add that application.');

    const drafts = buildChecklist(requirementsData, resolvedPlan);
    if (drafts.length > 0) {
      await tc.sdb.insert(
        S.applicationItems,
        drafts.map((d) => ({
          applicationId: application.id,
          ruleKey: d.ruleKey,
          kind: d.kind,
          title: d.title,
          description: d.description,
          source: d.source,
          dueDate: d.dueDate,
          importance: d.importance,
          effort: d.effort,
          dependsOnOthers: d.dependsOnOthers,
          blocking: d.blocking,
        })),
      );
    }

    await tc.deps.enqueuer.enqueue('maintenance.recompute_next_actions', { studentId: tc.studentId, reason: 'application_added' });
    await appendAudit(tc.sdb, { actor: 'agent', action: 'application.added', entityType: 'application', entityId: application.id, details: { school: schoolName, plan: resolvedPlan } });

    const verificationNote = needsVerification ? " I don't have verified requirements for them yet, so flag me if anything looks off." : '';
    return ok({ applicationId: application.id, schoolId }, `Added ${schoolName} (${resolvedPlan}, due ${deadline}).${verificationNote}`);
  },
});
