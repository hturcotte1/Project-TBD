import { describe, expect, it } from 'vitest';
import { formatE164ForDisplay, formatUsPhoneAsYouType, isValidE164, toE164 } from '@/lib/phone';

describe('isValidE164', () => {
  it('accepts a well-formed E.164 number', () => {
    expect(isValidE164('+15555550100')).toBe(true);
  });

  it('rejects numbers without a leading +, with a leading zero, or too short', () => {
    expect(isValidE164('15555550100')).toBe(false);
    expect(isValidE164('+05555550100')).toBe(false);
    expect(isValidE164('+1555')).toBe(false);
  });
});

describe('toE164', () => {
  it('assumes +1 for a bare 10-digit US number', () => {
    expect(toE164('3125550100')).toBe('+13125550100');
  });

  it('formats a friendly-formatted US number the same way', () => {
    expect(toE164('(312) 555-0100')).toBe('+13125550100');
  });

  it('passes through an already-valid E.164 number', () => {
    expect(toE164('+13125550100')).toBe('+13125550100');
  });

  it('returns null for something that cannot be parsed into E.164', () => {
    expect(toE164('123')).toBeNull();
    expect(toE164('')).toBeNull();
  });
});

describe('formatUsPhoneAsYouType', () => {
  it('builds up the (xxx) xxx-xxxx pattern progressively', () => {
    expect(formatUsPhoneAsYouType('3')).toBe('(3');
    expect(formatUsPhoneAsYouType('312555')).toBe('(312) 555');
    expect(formatUsPhoneAsYouType('3125550100')).toBe('(312) 555-0100');
  });

  it('drops a leading country code digit', () => {
    expect(formatUsPhoneAsYouType('13125550100')).toBe('(312) 555-0100');
  });
});

describe('formatE164ForDisplay', () => {
  it('formats a US number with a country code and grouping', () => {
    expect(formatE164ForDisplay('+13125550100')).toBe('+1 (312) 555-0100');
  });
});
