import { jobIds } from '@tbd/shared/jobs';
import { describe, expect, it } from 'vitest';
import { authHeader, makeTestApp } from '../testHelpers';

describe('onboarding', () => {
  it('walks through steps 1-7 and complete, persisting rows and enqueuing jobs', async () => {
    const { app, studentId, token, deps } = await makeTestApp();
    const headers = authHeader(await token(studentId));

    const getRes = await app.inject({ method: 'GET', url: '/onboarding', headers });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().step).toBe(1);

    // step 1: basics + phone
    const step1 = await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: {
        step: 1,
        data: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          preferred_name: 'Ada',
          phone_e164: '+15555559999',
          high_school: 'Somewhere High',
          graduation_year: 2027,
          timezone: 'America/Chicago',
          quiet_hours: { start: '22:00', end: '07:00' },
          nudge_intensity: 'normal',
        },
      },
    });
    expect(step1.statusCode).toBe(200);
    let state = step1.json();
    expect(state.step).toBe(2);
    expect(state.student.phone_e164).toBe('+15555559999');

    // step 2: academics / test scores
    const step2 = await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: { step: 2, data: { academics: {}, test_scores: {} } },
    });
    expect(step2.statusCode).toBe(200);
    state = step2.json();
    expect(state.step).toBe(3);
    expect(state.profile).not.toBeNull();

    // step 3: activities
    const step3 = await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: {
        step: 3,
        data: {
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
      },
    });
    expect(step3.statusCode).toBe(200);
    state = step3.json();
    expect(state.step).toBe(4);
    expect(state.activities.length).toBe(1);

    // step 4 fails without a narrative
    const step4Fail = await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 4, data: { narrative_confirmed: true } } });
    expect(step4Fail.statusCode).toBe(400);
    expect(step4Fail.json().code).toBe('narrative_missing');

    const narrativeRes = await app.inject({ method: 'PUT', url: '/narrative', headers, payload: {} });
    expect(narrativeRes.statusCode).toBe(200);

    const step4 = await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 4, data: { narrative_confirmed: true } } });
    expect(step4.statusCode).toBe(200);
    expect(step4.json().step).toBe(5);

    // step 5: goals/demographics + applications (known slug + free text), and enqueue agent.welcome
    const step5 = await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: {
        step: 5,
        data: {
          goals: { intended_majors: ['Undecided'] },
          demographics: { first_generation: true },
          applications: [
            { school_slug: 'purdue', plan: 'EA', self_assessment: 'target' },
            { school_name: 'A Totally Custom College', plan: 'RD', self_assessment: 'reach' },
          ],
        },
      },
    });
    expect(step5.statusCode).toBe(200);
    state = step5.json();
    expect(state.step).toBe(6);
    expect(state.applications.length).toBe(2);
    const purdue = state.applications.find((a: { school: { slug: string } }) => a.school.slug === 'purdue');
    expect(purdue).toBeTruthy();
    expect(purdue.counts.total).toBeGreaterThan(0);
    expect(deps.enqueuer.ofName('agent.welcome').some((j) => j.id === jobIds.welcome(studentId))).toBe(true);

    // step 6
    const step6 = await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 6, data: { acknowledged: true } } });
    expect(step6.statusCode).toBe(200);
    expect(step6.json().step).toBe(7);

    // step 7 is a no-op
    const step7 = await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 7, data: {} } });
    expect(step7.statusCode).toBe(200);
    expect(step7.json().step).toBe(7);

    // complete: no credentials connected, so no full_sync; first_plan always enqueued
    const complete = await app.inject({ method: 'POST', url: '/onboarding/complete', headers });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().completed).toBe(true);
    expect(deps.enqueuer.ofName('browser.full_sync').length).toBe(0);
    expect(deps.enqueuer.ofName('maintenance.first_plan').some((j) => j.payload.studentId === studentId)).toBe(true);

    // idempotent: calling again does not enqueue a second first_plan job with a new id, and stays completed
    const before = deps.enqueuer.ofName('maintenance.first_plan').length;
    const complete2 = await app.inject({ method: 'POST', url: '/onboarding/complete', headers });
    expect(complete2.statusCode).toBe(200);
    expect(deps.enqueuer.ofName('maintenance.first_plan').length).toBe(before);
  });

  it('skips a duplicate application on step 5 instead of failing the whole step', async () => {
    const { app, studentId, token } = await makeTestApp();
    const headers = authHeader(await token(studentId));
    await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: {
        step: 1,
        data: {
          first_name: 'B',
          last_name: 'C',
          preferred_name: '',
          phone_e164: '+15555551234',
          high_school: 'HS',
          graduation_year: 2027,
          timezone: 'UTC',
          quiet_hours: { start: '22:00', end: '07:00' },
          nudge_intensity: 'normal',
        },
      },
    });
    await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 2, data: { academics: {}, test_scores: {} } } });
    await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 3, data: { activities: [] } } });
    await app.inject({ method: 'PUT', url: '/narrative', headers, payload: {} });
    await app.inject({ method: 'POST', url: '/onboarding/step', headers, payload: { step: 4, data: { narrative_confirmed: true } } });

    const step5 = await app.inject({
      method: 'POST',
      url: '/onboarding/step',
      headers,
      payload: {
        step: 5,
        data: {
          goals: {},
          demographics: {},
          applications: [
            { school_slug: 'purdue', plan: 'EA', self_assessment: null },
            { school_slug: 'purdue', plan: 'EA', self_assessment: null },
          ],
        },
      },
    });
    expect(step5.statusCode).toBe(200);
    expect(step5.json().applications.length).toBe(1);
  });
});
