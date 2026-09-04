import * as S from '@tbd/shared/db/schema';
import { scoped } from '@tbd/shared/db';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

async function seedPersonalEssay(deps: { db: import('@tbd/shared/db').Db }, studentId: string): Promise<string> {
  const sdb = scoped(deps.db, studentId);
  const [essay] = await sdb.insert(S.essays, { applicationId: null, applicationItemId: null, title: 'Personal essay', prompt: 'Prompt 5', wordLimit: 650 });
  return essay!.id;
}

describe('essays', () => {
  it('autosave updates the current dashboard draft in place; version creates a new draft', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const essayId = await seedPersonalEssay(deps, studentId);

    const auto1 = await app.inject({ method: 'POST', url: `/essays/${essayId}/drafts`, headers, payload: { content: 'First draft text here', mode: 'autosave' } });
    expect(auto1.statusCode).toBe(200);
    let detail = auto1.json();
    expect(detail.drafts.length).toBe(1);
    expect(detail.current_draft.version).toBe(1);
    expect(detail.current_word_count).toBe(4);

    const auto2 = await app.inject({ method: 'POST', url: `/essays/${essayId}/drafts`, headers, payload: { content: 'First draft text here plus more', mode: 'autosave' } });
    detail = auto2.json();
    expect(detail.drafts.length).toBe(1); // still one draft row, updated in place
    expect(detail.current_draft.content).toContain('plus more');

    const version = await app.inject({ method: 'POST', url: `/essays/${essayId}/drafts`, headers, payload: { content: 'A brand new version', mode: 'version' } });
    detail = version.json();
    expect(detail.drafts.length).toBe(2);
    expect(detail.current_draft.version).toBe(2);
  });

  it('requesting feedback enqueues agent.essay_feedback and creates a pending run', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const essayId = await seedPersonalEssay(deps, studentId);
    await app.inject({ method: 'POST', url: `/essays/${essayId}/drafts`, headers, payload: { content: 'Some draft', mode: 'autosave' } });

    const res = await app.inject({ method: 'POST', url: `/essays/${essayId}/feedback`, headers });
    expect(res.statusCode).toBe(200);
    const { run_id } = res.json();
    expect(run_id).toBeTruthy();

    const jobs = deps.enqueuer.ofName('agent.essay_feedback');
    expect(jobs.some((j) => j.payload.runId === run_id && j.payload.essayId === essayId)).toBe(true);

    const runRes = await app.inject({ method: 'GET', url: `/agent-runs/${run_id}`, headers });
    expect(runRes.statusCode).toBe(200);
    expect(runRes.json().outcome).toBe('pending');
  });

  it('feedback is refused with no_draft when there is no current draft', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const essayId = await seedPersonalEssay(deps, studentId);
    const res = await app.inject({ method: 'POST', url: `/essays/${essayId}/feedback`, headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('no_draft');
  });
});
