import { describe, expect, it } from 'vitest';
import { derivePerSchoolStatus } from '@/components/recommenders/recommender-status';

describe('derivePerSchoolStatus', () => {
  it('is pending with no dates and no evidence', () => {
    const result = derivePerSchoolStatus({ status: 'pending', invited_at: null, submitted_at: null, evidence: null });
    expect(result).toEqual({ status: 'pending', label: 'Not yet invited', badgeVariant: 'outline', lastSeenText: 'Not yet invited for this school.' });
  });

  it('is invited once invited_at is set, even before status catches up', () => {
    const result = derivePerSchoolStatus({ status: 'pending', invited_at: '2026-09-02', submitted_at: null, evidence: null });
    expect(result.status).toBe('invited');
    expect(result.badgeVariant).toBe('warn');
    expect(result.lastSeenText).toBe('Invited — no confirmation from Common App yet.');
  });

  it('is submitted once submitted_at is set, even if status still says invited', () => {
    const result = derivePerSchoolStatus({ status: 'invited', invited_at: '2026-09-02', submitted_at: '2026-09-05', evidence: null });
    expect(result.status).toBe('submitted');
    expect(result.badgeVariant).toBe('success');
  });

  it('prefers submitted over invited when both dates are present', () => {
    const result = derivePerSchoolStatus({ status: 'submitted', invited_at: '2026-09-02', submitted_at: '2026-09-05', evidence: null });
    expect(result.status).toBe('submitted');
  });

  it('uses the evidence text as the last-seen line when present', () => {
    const result = derivePerSchoolStatus({
      status: 'submitted',
      invited_at: '2026-09-01',
      submitted_at: '2026-09-01',
      evidence: { seen_at: '2026-09-03T12:00:00.000Z', text: 'Mr. Okafor submitted 2026-09-01', confidence: 0.95, source_url: null },
    });
    expect(result.lastSeenText).toBe('Last seen: Mr. Okafor submitted 2026-09-01');
  });
});
