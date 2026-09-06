import { describe, expect, it } from 'vitest';
import { applicationStatusWord, isSyncActive, needsVerificationCode } from '@/components/schools/sync-state';

describe('isSyncActive', () => {
  it('is true only while a job is queued or running', () => {
    expect(isSyncActive('queued')).toBe(true);
    expect(isSyncActive('running')).toBe(true);
    expect(isSyncActive('succeeded')).toBe(false);
    expect(isSyncActive('failed')).toBe(false);
    expect(isSyncActive('awaiting_verification_code')).toBe(false);
    expect(isSyncActive(null)).toBe(false);
    expect(isSyncActive(undefined)).toBe(false);
  });
});

describe('needsVerificationCode', () => {
  it('matches a pause reason that mentions a verification code, case-insensitively', () => {
    expect(needsVerificationCode('Waiting on a verification code')).toBe(true);
    expect(needsVerificationCode('WAITING ON A VERIFICATION CODE')).toBe(true);
  });

  it('is false for an unrelated or absent pause reason', () => {
    expect(needsVerificationCode('browser_failures')).toBe(false);
    expect(needsVerificationCode(null)).toBe(false);
    expect(needsVerificationCode(undefined)).toBe(false);
  });
});

describe('applicationStatusWord', () => {
  it('shows Submitted first, regardless of sync state', () => {
    expect(applicationStatusWord({ status: 'submitted', syncActive: true, needsCode: true })).toEqual({ text: 'Submitted', tone: 'ok' });
  });

  it('shows Needs a code before Syncing', () => {
    expect(applicationStatusWord({ status: 'in_progress', syncActive: true, needsCode: true })).toEqual({ text: 'Needs a code', tone: 'muted' });
  });

  it('shows Syncing when a job is active and no code is needed', () => {
    expect(applicationStatusWord({ status: 'in_progress', syncActive: true, needsCode: false })).toEqual({ text: 'Syncing', tone: 'muted' });
  });

  it('is blank otherwise', () => {
    expect(applicationStatusWord({ status: 'not_started', syncActive: false, needsCode: false })).toBeNull();
  });
});
