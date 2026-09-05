import type * as S from '@apogee/shared/db/schema';
import type * as D from '@apogee/shared/api';
import { daysUntil } from '@apogee/shared/time';

export function mapEssayDraft(row: S.EssayDraft): D.EssayDraftDto {
  return { id: row.id, version: row.version, content: row.content, word_count: row.wordCount, source: row.source, created_at: row.createdAt.toISOString() };
}

export function mapEssayFeedback(row: S.EssayFeedbackRow): D.EssayFeedbackDto {
  return { id: row.id, essay_draft_id: row.essayDraftId, feedback: row.feedback, created_at: row.createdAt.toISOString() };
}

export interface EssaySummaryInput {
  essay: S.Essay;
  schoolName: string | null;
  dueDate: string | null;
  status: S.ApplicationItem['status'] | null;
  currentDraft: S.EssayDraft | null;
  draftCount: number;
  feedbackCount: number;
  now: Date;
  timezone: string;
}

export function mapEssay(input: EssaySummaryInput): D.EssayDto {
  return {
    id: input.essay.id,
    application_id: input.essay.applicationId,
    application_item_id: input.essay.applicationItemId,
    school_name: input.schoolName,
    title: input.essay.title,
    prompt: input.essay.prompt,
    word_limit: input.essay.wordLimit,
    due_date: input.dueDate,
    days_remaining: input.dueDate ? daysUntil(input.dueDate, input.now, input.timezone) : null,
    current_word_count: input.currentDraft?.wordCount ?? 0,
    draft_count: input.draftCount,
    last_edited_at: input.currentDraft ? input.currentDraft.createdAt.toISOString() : null,
    feedback_count: input.feedbackCount,
    status: input.status,
  };
}

export interface EssayDetailInput extends EssaySummaryInput {
  drafts: S.EssayDraft[];
  feedback: S.EssayFeedbackRow[];
}

export function mapEssayDetail(input: EssayDetailInput): D.EssayDetailDto {
  return {
    ...mapEssay(input),
    current_draft: input.currentDraft ? mapEssayDraft(input.currentDraft) : null,
    drafts: input.drafts.map(mapEssayDraft),
    feedback: input.feedback.map(mapEssayFeedback),
  };
}
