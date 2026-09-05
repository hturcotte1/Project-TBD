import { scoped, approvalsRepo } from '@apogee/shared/db';
import { buildActivitiesFillPayload } from '@apogee/shared/domain';
import * as S from '@apogee/shared/db/schema';
import { createTestStudent } from '@apogee/shared/testing';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('approvals', () => {
  it('propose-fill for activities matches buildActivitiesFillPayload, then approve enqueues a fill job', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    await app.inject({
      method: 'PUT',
      url: '/activities',
      headers,
      payload: {
        activities: [
          {
            activity_type: 'debate_speech',
            position: 'Captain',
            organization: 'Debate Club',
            description: 'Lead the team',
            grade_levels: ['11', '12'],
            timing: ['school_year'],
            hours_per_week: 5,
            weeks_per_year: 30,
            continue_in_college: true,
          },
        ],
      },
    });

    const propose = await app.inject({ method: 'POST', url: '/approvals/propose-fill', headers, payload: { section: 'activities', school_slug: null } });
    expect(propose.statusCode).toBe(200);
    const approval = propose.json();
    expect(approval.status).toBe('pending');

    const sdb = scoped(deps.db, studentId);
    const activityRows = await sdb.select(S.activities);
    const expectedPayload = buildActivitiesFillPayload(activityRows);
    expect(approval.payload).toEqual(expectedPayload);

    const answer = await app.inject({ method: 'POST', url: `/approvals/${approval.id}/answer`, headers, payload: { approve: true } });
    expect(answer.statusCode).toBe(200);
    const answered = answer.json();
    expect(answered.status).toBe('approved');
    expect(answered.resulting_job_id).toBeTruthy();

    const fillJobs = deps.enqueuer.ofName('browser.fill_fields');
    expect(fillJobs.some((j) => j.payload.approvalId === approval.id && j.payload.browserJobId === answered.resulting_job_id)).toBe(true);

    const jobRows = await sdb.select(S.browserJobs);
    expect(jobRows.some((j) => j.id === answered.resulting_job_id && j.kind === 'fill_fields')).toBe(true);
  });

  it('rejecting an approval does not enqueue a browser job', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({
      method: 'PUT',
      url: '/activities',
      headers,
      payload: {
        activities: [
          {
            activity_type: 'debate_speech',
            position: 'Captain',
            organization: 'Debate Club',
            description: 'Lead the team',
            grade_levels: ['11', '12'],
            timing: ['school_year'],
            hours_per_week: 5,
            weeks_per_year: 30,
            continue_in_college: true,
          },
        ],
      },
    });
    const propose = await app.inject({ method: 'POST', url: '/approvals/propose-fill', headers, payload: { section: 'activities', school_slug: null } });
    expect(propose.statusCode).toBe(200);
    const approval = propose.json();

    const answer = await app.inject({ method: 'POST', url: `/approvals/${approval.id}/answer`, headers, payload: { approve: false } });
    expect(answer.statusCode).toBe(200);
    expect(answer.json().status).toBe('rejected');
    expect(deps.enqueuer.ofName('browser.fill_fields').length).toBe(0);
  });

  it('college_questions propose-fill is unsupported', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const res = await app.inject({ method: 'POST', url: '/approvals/propose-fill', headers, payload: { section: 'college_questions', school_slug: 'purdue' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('unsupported_section');
  });

  it('a submit-kind approval is refused at autonomy level B', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    const sdb = scoped(deps.db, studentId);
    const approval = await approvalsRepo.create(sdb, { kind: 'submit', summary: 'Submit to Purdue', payload: { kind: 'submit', school_slug: 'purdue' }, requestedVia: 'dashboard' });

    const res = await app.inject({ method: 'POST', url: `/approvals/${approval.id}/answer`, headers, payload: { approve: true } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('autonomy_level');
  });

  it('cross-student: student B cannot answer student A approval', async () => {
    const { app, studentId: aId, token, deps } = await makeTestApp();
    const sdb = scoped(deps.db, aId);
    const approval = await approvalsRepo.create(sdb, {
      kind: 'custom',
      summary: 'Something',
      payload: { kind: 'custom', description: 'x', data: {} },
      requestedVia: 'dashboard',
    });

    const b = await createTestStudent(deps.db, { phoneE164: null });
    const headersB = authHeader(await token(b.id));
    const res = await app.inject({ method: 'POST', url: `/approvals/${approval.id}/answer`, headers: headersB, payload: { approve: true } });
    expect(res.statusCode).toBe(404);
  });
});
