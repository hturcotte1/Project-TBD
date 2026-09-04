import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { defineTool, fail, ok } from './types';
import { bestMatch, matchesSchoolName } from './util';

export const UpdateRecommenderStatusInput = z.object({
  recommender: z.string().min(1).max(200),
  school: z.string().min(1).max(200).optional(),
  status: z.enum(['invited', 'submitted', 'declined']),
  evidence: z.string().min(1).max(500),
});

/**
 * `authorization: 'any'` — this is the intended effect of a photo of a recommender's email or a
 * portal screenshot (an `extracted_content`-origin signal), not something that requires the
 * student to have typed a request for it.
 */
export const updateRecommenderStatusTool = defineTool({
  name: 'updateRecommenderStatus',
  description: "Update a recommender's invite/submission status from evidence the student sent (e.g. a screenshot of an email).",
  inputSchema: UpdateRecommenderStatusInput,
  authorization: 'any',
  async run(tc, input) {
    const recMatch = bestMatch(input.recommender, tc.ctx.recommenders, (r) => r.recommender.name);
    if (!recMatch) return fail(`I don't have a recommender matching "${input.recommender}" on file.`);

    let assignment = recMatch.assignments[0] ?? null;
    if (input.school) {
      const bySchool = recMatch.assignments.find((a) => a.schoolName && matchesSchoolName(input.school as string, a.schoolName));
      if (bySchool) assignment = bySchool;
    }

    const now = tc.deps.clock.now();
    const evidence = { seen_at: now.toISOString(), text: input.evidence, confidence: 0.7, source_url: null };
    // recommender_assignments.status has no "declined" value; a decline resets it to pending.
    const assignmentStatus: 'pending' | 'invited' | 'submitted' = input.status === 'declined' ? 'pending' : input.status;

    if (assignment) {
      await tc.sdb.update(
        S.recommenderAssignments,
        {
          status: assignmentStatus,
          submittedAt: input.status === 'submitted' ? now.toISOString().slice(0, 10) : assignment.assignment.submittedAt,
          evidence,
        },
        eq(S.recommenderAssignments.id, assignment.assignment.id),
      );
      if (input.status === 'submitted') {
        const item = await tc.sdb.selectOne(
          S.applicationItems,
          and(eq(S.applicationItems.recommenderId, recMatch.recommender.id), eq(S.applicationItems.applicationId, assignment.assignment.applicationId)),
        );
        if (item) {
          await tc.sdb.update(S.applicationItems, { status: 'done', completedAt: now, evidence }, eq(S.applicationItems.id, item.id));
        }
      }
    }

    await tc.sdb.update(
      S.recommenders,
      { inviteStatus: input.status === 'declined' ? 'not_invited' : input.status },
      eq(S.recommenders.id, recMatch.recommender.id),
    );
    await appendAudit(tc.sdb, {
      actor: 'agent',
      action: 'recommender.status_updated',
      entityType: 'recommender',
      entityId: recMatch.recommender.id,
      details: { status: input.status, school: input.school ?? null },
    });

    return ok(
      { recommenderId: recMatch.recommender.id, status: input.status, submitted: input.status === 'submitted' },
      `${recMatch.recommender.name} is now marked "${input.status}"${assignment?.schoolName ? ` for ${assignment.schoolName}` : ''}.`,
    );
  },
});
