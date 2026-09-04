import { describe, expect, it } from 'vitest';
import { humanizeAuditAction, redactDetails } from '@/components/activity/audit-utils';

describe('humanizeAuditAction', () => {
  it('maps known actions to plain-language labels', () => {
    expect(humanizeAuditAction('sync.completed')).toBe('Synced with Common App');
    expect(humanizeAuditAction('message.sent')).toBe('Sent a message');
    expect(humanizeAuditAction('approval.created')).toBe('Asked for your approval');
    expect(humanizeAuditAction('fill.verified')).toBe('Verified a filled-in field');
    expect(humanizeAuditAction('tool_origin_blocked')).toBe('Blocked an unsafe action');
  });

  it('falls back to a title-cased guess for an unrecognized action', () => {
    expect(humanizeAuditAction('weekly_plan.rebuilt')).toBe('Weekly Plan Rebuilt');
    expect(humanizeAuditAction('some-new.thing_here')).toBe('Some New Thing Here');
  });

  it('returns the raw string when nothing can be split out of it', () => {
    expect(humanizeAuditAction('')).toBe('');
  });
});

describe('redactDetails', () => {
  it('redacts common sensitive keys regardless of casing', () => {
    const entries = redactDetails({ password: 'hunter2', Verification_Code: '123456', essay_body: 'my personal statement...' });
    expect(entries).toEqual([
      { key: 'password', value: '[redacted]' },
      { key: 'Verification_Code', value: '[redacted]' },
      { key: 'essay_body', value: '[redacted]' },
    ]);
  });

  it('does not redact an id field that merely mentions a sensitive term', () => {
    const entries = redactDetails({ essay_id: '11111111-1111-4111-8111-111111111111' });
    expect(entries).toEqual([{ key: 'essay_id', value: '11111111-1111-4111-8111-111111111111' }]);
  });

  it('redacts a snake_case key even when the sensitive term is not at a word boundary', () => {
    // "message_body" and "zip_code" both have underscores on both sides of the interesting part,
    // so a naive `\bterm\b` regex would miss them — this is exactly the case that guards against that.
    const entries = redactDetails({ message_body: 'hey what should i do first', reply_code: '482910' });
    expect(entries).toEqual([
      { key: 'message_body', value: '[redacted]' },
      { key: 'reply_code', value: '[redacted]' },
    ]);
  });

  it('passes through ordinary values untouched, stringifying objects', () => {
    const entries = redactDetails({ school_name: 'University of Michigan', changes_count: 3, ok: true, evidence: { seen_at: '2026-09-03T00:00:00.000Z' } });
    expect(entries).toEqual([
      { key: 'school_name', value: 'University of Michigan' },
      { key: 'changes_count', value: '3' },
      { key: 'ok', value: 'true' },
      { key: 'evidence', value: '{"seen_at":"2026-09-03T00:00:00.000Z"}' },
    ]);
  });

  it('shows an em dash for null/undefined and truncates very long strings', () => {
    const longValue = 'x'.repeat(250);
    const entries = redactDetails({ note: null, long: longValue });
    expect(entries[0]).toEqual({ key: 'note', value: '—' });
    expect(entries[1]?.value.endsWith('…')).toBe(true);
    expect(entries[1]?.value.length).toBe(201);
  });
});
