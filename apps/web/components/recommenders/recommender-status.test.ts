import { describe, expect, it } from 'vitest';
import { derivePerSchoolStatus, summarizeSchoolStatuses } from '@/components/recommenders/recommender-status';

describe('derivePerSchoolStatus', () => {
  it('is pending with no dates and no evidence, toned like a far-off deadline', () => {
    const result = derivePerSchoolStatus({ status: 'pending', invited_at: null, submitted_at: null, evidence: null }, 60);
    expect(result).toEqual({ status: 'pending', label: 'Not yet invited', tone: 0, lastSeenText: 'Not yet invited for this school.' });
  });

  it('is invited once invited_at is set, even before status catches up', () => {
    const result = derivePerSchoolStatus({ status: 'pending', invited_at: '2026-09-02', submitted_at: null, evidence: null }, 20);
    expect(result.status).toBe('invited');
    expect(result.tone).toBe(1);
    expect(result.lastSeenText).toBe('Invited — no confirmation from Common App yet.');
  });

  it('colors an invited row hotter as its deadline gets closer', () => {
    const far = derivePerSchoolStatus({ status: 'invited', invited_at: '2026-09-02', submitted_at: null, evidence: null }, 45);
    const near = derivePerSchoolStatus({ status: 'invited', invited_at: '2026-09-02', submitted_at: null, evidence: null }, 2);
    expect(far.tone).toBe(0);
    expect(near.tone).toBe(4);
  });

  it('is submitted once submitted_at is set, even if status still says invited', () => {
    const result = derivePerSchoolStatus({ status: 'invited', invited_at: '2026-09-02', submitted_at: '2026-09-05', evidence: null }, 5);
    expect(result.status).toBe('submitted');
    expect(result.tone).toBe('ok');
  });

  it('prefers submitted over invited when both dates are present', () => {
    const result = derivePerSchoolStatus({ status: 'submitted', invited_at: '2026-09-02', submitted_at: '2026-09-05', evidence: null }, 5);
    expect(result.status).toBe('submitted');
    expect(result.tone).toBe('ok');
  });

  it('uses the evidence text as the last-seen line when present', () => {
    const result = derivePerSchoolStatus(
      {
        status: 'submitted',
        invited_at: '2026-09-01',
        submitted_at: '2026-09-01',
        evidence: { seen_at: '2026-09-03T12:00:00.000Z', text: 'Mr. Okafor submitted 2026-09-01', confidence: 0.95, source_url: null },
      },
      0,
    );
    expect(result.lastSeenText).toBe('Last seen: Mr. Okafor submitted 2026-09-01');
  });

  it('a submitted deadline never carries heat, regardless of days remaining', () => {
    const result = derivePerSchoolStatus({ status: 'submitted', invited_at: '2026-09-01', submitted_at: '2026-09-01', evidence: null }, -3);
    expect(result.tone).toBe('ok');
  });
});

describe('summarizeSchoolStatuses', () => {
  it('says there are none assigned when the list is empty', () => {
    expect(summarizeSchoolStatuses([])).toBe('Not assigned to any school yet');
  });

  it('counts a single school without pluralizing "school"', () => {
    const result = summarizeSchoolStatuses([{ status: 'submitted', invited_at: '2026-08-01', submitted_at: '2026-08-10', evidence: null }]);
    expect(result).toBe('1 school: 1 submitted');
  });

  it('lists submitted, then invited, then pending, skipping empty buckets', () => {
    const result = summarizeSchoolStatuses([
      { status: 'submitted', invited_at: '2026-08-01', submitted_at: '2026-08-10', evidence: null },
      { status: 'invited', invited_at: '2026-08-02', submitted_at: null, evidence: null },
      { status: 'invited', invited_at: '2026-08-03', submitted_at: null, evidence: null },
    ]);
    expect(result).toBe('3 schools: 1 submitted, 2 invited');
  });

  it('includes a not-yet-invited bucket when present', () => {
    const result = summarizeSchoolStatuses([
      { status: 'pending', invited_at: null, submitted_at: null, evidence: null },
      { status: 'invited', invited_at: '2026-08-03', submitted_at: null, evidence: null },
    ]);
    expect(result).toBe('2 schools: 1 invited, 1 not yet invited');
  });

  it('derives status from dates even when every row is nominally pending', () => {
    const result = summarizeSchoolStatuses([{ status: 'pending', invited_at: null, submitted_at: '2026-08-10', evidence: null }]);
    expect(result).toBe('1 school: 1 submitted');
  });
});
