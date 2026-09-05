import { describe, expect, it } from 'vitest';
import { authorizedByStudentText, originAllows } from './authorization';
import { TOOLS } from './registry';
import type { AgentTool } from './types';

function tool(name: string): AgentTool<never> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t as unknown as AgentTool<never>;
}

describe('tool authorization matrix', () => {
  it('read-only and photo-effect tools are authorization "any"', () => {
    for (const name of ['getApplicationStatus', 'listNextActions', 'explainRequirement', 'getEssay', 'sendDashboardLink', 'updateRecommenderStatus']) {
      expect(tool(name).authorization).toBe('any');
    }
  });

  it('state-mutating conversational tools are authorization "student_text"', () => {
    for (const name of [
      'markItemDone',
      'snoozeItem',
      'addCustomItem',
      'saveEssayDraft',
      'requestSync',
      'proposeFillFields',
      'approveProposal',
      'rejectProposal',
      'answerVerificationCode',
      'setQuietHours',
      'snoozeNotifications',
      'addApplication',
    ]) {
      expect(tool(name).authorization).toBe('student_text');
    }
  });

  it('"any" tools are allowed from every origin', () => {
    const t = tool('getApplicationStatus');
    for (const origin of ['student_message', 'approval', 'extracted_content', 'system'] as const) {
      expect(originAllows(t, origin)).toBe(true);
    }
  });

  it('"student_text" tools are only allowed from student_message or approval origins', () => {
    const t = tool('markItemDone');
    expect(originAllows(t, 'student_message')).toBe(true);
    expect(originAllows(t, 'approval')).toBe(true);
    expect(originAllows(t, 'extracted_content')).toBe(false);
    expect(originAllows(t, 'system')).toBe(false);
  });

  it('markItemDone requires completion language in the student text', () => {
    const t = tool('markItemDone');
    expect(authorizedByStudentText(t, "I'm done with the Georgetown supp", { query: 'georgetown' })).toBe(true);
    expect(authorizedByStudentText(t, 'what is the weather like', { query: 'georgetown' })).toBe(false);
  });

  it('proposeFillFields requires fill/put/enter/add language paired with Common App', () => {
    const t = tool('proposeFillFields');
    expect(authorizedByStudentText(t, 'can you put my activities into common app', { section: 'activities' })).toBe(true);
    expect(authorizedByStudentText(t, 'fill in my activities please', { section: 'activities' })).toBe(true);
    expect(authorizedByStudentText(t, 'tell me a joke', { section: 'activities' })).toBe(false);
  });

  it('saveEssayDraft requires the text to be a verbatim substring of the student message', () => {
    const t = tool('saveEssayDraft');
    const studentText = 'Here is my new draft: I grew up working weekends at my family taqueria.';
    expect(authorizedByStudentText(t, studentText, { essay_query: 'personal', text: 'I grew up working weekends at my family taqueria.' })).toBe(true);
    expect(authorizedByStudentText(t, studentText, { essay_query: 'personal', text: 'a sentence the model made up' })).toBe(false);
  });

  it('requestSync requires sync/check/refresh/look language', () => {
    const t = tool('requestSync');
    expect(authorizedByStudentText(t, 'can you sync my common app', {})).toBe(true);
    expect(authorizedByStudentText(t, 'check common app for me', {})).toBe(true);
    expect(authorizedByStudentText(t, 'hello there', {})).toBe(false);
  });

  it('a null studentText (a photo-only message) never authorizes student_text tools', () => {
    const t = tool('approveProposal');
    expect(authorizedByStudentText(t, null, {})).toBe(false);
    expect(authorizedByStudentText(t, '   ', {})).toBe(false);
  });

  it('every tool name is unique', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
