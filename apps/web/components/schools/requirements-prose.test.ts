import type { SchoolRequirementsData } from '@apogee/shared/schemas';
import { describe, expect, it } from 'vitest';
import { requirementsToSentences } from '@/components/schools/requirements-prose';

const TIMEZONE = 'America/New_York';

function requirements(overrides: Partial<SchoolRequirementsData> = {}): SchoolRequirementsData {
  return {
    cycle: '2026-27',
    plans: [{ plan: 'RD', deadline: '2027-01-01', notes: '', needs_verification: false }],
    supplements: [],
    recommendations: { teacher_min: 0, teacher_max: 0, counselor_required: false, other_max: 0, notes: '' },
    test_policy: 'optional',
    interview_policy: 'none',
    portfolio: { status: 'none', description: '' },
    midyear_report: true,
    css_profile: { required: false, deadline: null, needs_verification: false },
    fafsa_priority_deadline: null,
    application_fee: null,
    fee_waiver_eligible: true,
    needs_verification: false,
    source: 'internal_dataset',
    notes: '',
    ...overrides,
  };
}

describe('requirementsToSentences', () => {
  it('renders nothing for a topic with no data', () => {
    const sentences = requirementsToSentences('Michigan', requirements(), TIMEZONE);
    // Only the test-policy sentence has data in the bare-defaults fixture.
    expect(sentences).toEqual(['Test scores are optional for fall 2026.']);
  });

  it('describes required supplemental essays', () => {
    const reqs = requirements({
      supplements: [
        { id: 'why-us', title: 'Why us', prompt: '', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false },
        { id: 'activity', title: 'Activity', prompt: '', word_limit: 150, required: true, applies_to_plans: null, needs_verification: false },
      ],
    });
    expect(requirementsToSentences('Michigan', reqs, TIMEZONE)).toContain('Michigan asks for two supplemental essays.');
  });

  it('describes optional-only supplements separately from required ones', () => {
    const optionalOnly = requirements({
      supplements: [{ id: 'extra', title: 'Extra', prompt: '', word_limit: null, required: false, applies_to_plans: null, needs_verification: false }],
    });
    expect(requirementsToSentences('Purdue', optionalOnly, TIMEZONE)).toContain('Purdue offers one optional supplemental essay.');

    const mixed = requirements({
      supplements: [
        { id: 'why-us', title: 'Why us', prompt: '', word_limit: 300, required: true, applies_to_plans: null, needs_verification: false },
        { id: 'extra', title: 'Extra', prompt: '', word_limit: null, required: false, applies_to_plans: null, needs_verification: false },
      ],
    });
    expect(requirementsToSentences('Purdue', mixed, TIMEZONE)).toContain('Purdue asks for one supplemental essay and offers one optional one.');
  });

  it('describes teacher and counselor recommendations together', () => {
    const reqs = requirements({ recommendations: { teacher_min: 2, teacher_max: 2, counselor_required: true, other_max: 0, notes: '' } });
    expect(requirementsToSentences('Michigan', reqs, TIMEZONE)).toContain(
      'Michigan asks for two teacher recommendations and one counselor recommendation.',
    );
  });

  it('mentions an optional other recommendation', () => {
    const reqs = requirements({ recommendations: { teacher_min: 0, teacher_max: 0, counselor_required: true, other_max: 1, notes: '' } });
    expect(requirementsToSentences('Michigan', reqs, TIMEZONE)).toContain(
      'Michigan asks for one counselor recommendation and up to one other recommendation.',
    );
  });

  it('says nothing about recommendations when none are required', () => {
    const reqs = requirements({ recommendations: { teacher_min: 0, teacher_max: 0, counselor_required: false, other_max: 0, notes: '' } });
    expect(requirementsToSentences('Michigan', reqs, TIMEZONE).some((s) => s.includes('recommendation'))).toBe(false);
  });

  it('states each test policy in plain words', () => {
    expect(requirementsToSentences('Michigan', requirements({ test_policy: 'required' }), TIMEZONE)).toContain(
      'Test scores are required for fall 2026.',
    );
    expect(requirementsToSentences('Michigan', requirements({ test_policy: 'blind' }), TIMEZONE)).toContain(
      'Michigan does not consider test scores.',
    );
    expect(requirementsToSentences('Michigan', requirements({ test_policy: 'flexible' }), TIMEZONE)).toContain(
      'Michigan is test-flexible for fall 2026.',
    );
  });

  it('skips the interview sentence when there is no interview', () => {
    expect(requirementsToSentences('Michigan', requirements({ interview_policy: 'none' }), TIMEZONE).some((s) => s.includes('interview'))).toBe(
      false,
    );
  });

  it('states each non-"none" interview policy', () => {
    expect(requirementsToSentences('Michigan', requirements({ interview_policy: 'required' }), TIMEZONE)).toContain(
      'Michigan requires an interview.',
    );
    expect(requirementsToSentences('Michigan', requirements({ interview_policy: 'by_invitation' }), TIMEZONE)).toContain(
      'Michigan interviews by invitation.',
    );
  });

  it('describes the CSS Profile and a FAFSA priority deadline together', () => {
    const reqs = requirements({
      css_profile: { required: true, deadline: null, needs_verification: false },
      fafsa_priority_deadline: '2027-02-01',
    });
    expect(requirementsToSentences('Michigan', reqs, TIMEZONE)).toContain(
      'Michigan asks for the CSS Profile and the FAFSA by Mon, Feb 1 for priority consideration.',
    );
  });

  it('renders a fee amount with the waiver note, or a no-fee sentence at zero', () => {
    expect(requirementsToSentences('Michigan', requirements({ application_fee: 75 }), TIMEZONE)).toContain(
      "Michigan's application fee is $75. Fee waivers are available.",
    );
    expect(requirementsToSentences('Michigan', requirements({ application_fee: 0 }), TIMEZONE)).toContain(
      'Michigan does not charge an application fee.',
    );
  });

  it('mentions the fee only when there is something to say', () => {
    expect(requirementsToSentences('Michigan', requirements({ application_fee: null, fee_waiver_eligible: true }), TIMEZONE).some((s) => s.includes('fee'))).toBe(false);
    expect(requirementsToSentences('Michigan', requirements({ application_fee: null, fee_waiver_eligible: false }), TIMEZONE)).toContain(
      'Michigan does not offer fee waivers.',
    );
  });
});
