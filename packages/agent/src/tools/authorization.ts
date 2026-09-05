/**
 * Runtime guard against prompt injection: a tool marked `authorization: 'student_text'` may only
 * fire when (a) the run's origin is a real student message or an approval, and (b) the student's
 * own words plausibly asked for that specific action. Content pulled from a page, a document, or
 * a photo can suggest tool calls to the model, but it can never itself authorize one.
 */
import type { z } from 'zod';
import type { AgentTool, ToolRunOrigin } from './types';

export function originAllows(tool: AgentTool<z.ZodTypeAny>, origin: ToolRunOrigin): boolean {
  if (tool.authorization === 'any') return true;
  return origin === 'student_message' || origin === 'approval';
}

const DONE_WORDS = /\b(done|finished|finish|submitted|submit|completed|complete|sent|send)\b/i;
const FILL_WORDS = /\b(fill|put|enter|add)\b[\s\S]{0,30}\b(in|into)\b[\s\S]{0,20}\bcommon ?app\b|\bfill (in )?my\b/i;
const SYNC_WORDS = /\b(sync|check|refresh|look)\b/i;

/**
 * Whether the student's own text plausibly requested this specific tool call. `studentText` is
 * null for runs with no conversational text behind them (e.g. a dashboard Approve click recorded
 * as origin "approval") — with nothing to contradict the action, those are allowed through.
 */
export function authorizedByStudentText(tool: AgentTool<z.ZodTypeAny>, studentText: string | null, input: unknown): boolean {
  if (tool.authorization === 'any') return true;
  // No words from the student (a photo-only text, an extraction run) can never authorize an action;
  // approval-origin runs are exempted by the executor, not here.
  if (studentText === null || studentText.trim().length === 0) return false;
  const text = studentText.toLowerCase();
  switch (tool.name) {
    case 'markItemDone':
      return DONE_WORDS.test(text);
    case 'proposeFillFields':
      return FILL_WORDS.test(text);
    case 'saveEssayDraft': {
      const draft = typeof input === 'object' && input !== null && 'text' in input ? String((input as { text: unknown }).text ?? '') : '';
      return draft.trim().length > 0 && studentText.includes(draft);
    }
    case 'requestSync':
      return SYNC_WORDS.test(text);
    default:
      return true;
  }
}
