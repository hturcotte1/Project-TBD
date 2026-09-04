import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { appendAudit } from '@tbd/shared/db';
import * as S from '@tbd/shared/db/schema';
import { defineTool, fail, ok } from './types';
import { bestMatch } from './util';

const FEEDBACK_WORDS = /\b(feedback|thoughts|review|how'?s|how is|what do you think)\b/i;

export const GetEssayInput = z.object({ query: z.string().min(1).max(300) });

export const getEssayTool = defineTool({
  name: 'getEssay',
  description: "Look up an essay by fuzzy title/school match: metadata and word count. The draft text is included only when the student asked for feedback.",
  inputSchema: GetEssayInput,
  authorization: 'any',
  async run(tc, input) {
    const match = bestMatch(input.query, tc.ctx.essays, (e) => `${e.essay.title} ${e.essay.prompt} ${e.applicationSchoolName ?? ''}`);
    if (!match) return fail(`I couldn't find an essay matching "${input.query}".`);
    const wantsFeedback = tc.run.studentText !== null && FEEDBACK_WORDS.test(tc.run.studentText);
    const data: Record<string, unknown> = {
      essayId: match.essay.id,
      title: match.essay.title,
      prompt: match.essay.prompt,
      wordLimit: match.essay.wordLimit,
      currentWordCount: match.currentWordCount,
      school: match.applicationSchoolName,
    };
    let draftText: string | null = null;
    if (wantsFeedback && match.essay.currentDraftId) {
      const draft = await tc.sdb.selectOne(S.essayDrafts, eq(S.essayDrafts.id, match.essay.currentDraftId));
      draftText = draft?.content ?? null;
      if (draftText) data.draftText = draftText;
    }
    const summary = `"${match.essay.title}"${match.applicationSchoolName ? ` (${match.applicationSchoolName})` : ''}: ${match.currentWordCount ?? 0} word${
      match.currentWordCount === 1 ? '' : 's'
    }${match.essay.wordLimit ? ` of ${match.essay.wordLimit}` : ''}.${draftText ? `\nDRAFT:\n${draftText}` : ''}`;
    return ok(data, summary);
  },
});

export const SaveEssayDraftInput = z.object({ essay_query: z.string().min(1).max(300), text: z.string().min(1).max(10_000) });

export const saveEssayDraftTool = defineTool({
  name: 'saveEssayDraft',
  description: "Save a new draft version of an essay. `text` must be the student's own words, verbatim from their message — never AI-generated.",
  inputSchema: SaveEssayDraftInput,
  authorization: 'student_text',
  async run(tc, input) {
    const match = bestMatch(input.essay_query, tc.ctx.essays, (e) => `${e.essay.title} ${e.applicationSchoolName ?? ''}`);
    if (!match) return fail(`I couldn't find an essay matching "${input.essay_query}".`);
    const versions = await tc.sdb.select(S.essayDrafts, eq(S.essayDrafts.essayId, match.essay.id), { orderBy: desc(S.essayDrafts.version), limit: 1 });
    const nextVersion = (versions[0]?.version ?? 0) + 1;
    const wordCount = input.text.trim().split(/\s+/).filter(Boolean).length;
    const [draft] = await tc.sdb.insert(S.essayDrafts, { essayId: match.essay.id, version: nextVersion, content: input.text, wordCount, source: 'student_message' });
    if (!draft) return fail('Could not save that draft.');
    await tc.sdb.update(S.essays, { currentDraftId: draft.id }, eq(S.essays.id, match.essay.id));
    await appendAudit(tc.sdb, { actor: 'agent', action: 'essay.draft_saved', entityType: 'essay', entityId: match.essay.id, details: { version: nextVersion, wordCount } });
    return ok({ essayId: match.essay.id, draftId: draft.id, wordCount, version: nextVersion }, `Saved v${nextVersion} of "${match.essay.title}" — ${wordCount} words.`);
  },
});
