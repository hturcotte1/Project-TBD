/**
 * Phone helpers for onboarding. Validation mirrors the API contract's E.164 regex exactly
 * (`OnboardingStepBody` step 1, `phone_e164`) so a value that passes here never gets rejected there.
 */
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidE164(value: string): boolean {
  return E164_REGEX.test(value);
}

/**
 * Formats raw keystrokes into a friendly US-style display as the student types, e.g. "3125550100"
 * or "(312) 555-0100" both become "(312) 555-0100". A leading 1 (country code) is dropped since the
 * display is US-focused; the underlying value is still normalized to full E.164 by `toE164`.
 */
export function formatUsPhoneAsYouType(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^1/, '').slice(0, 10);
  const len = digits.length;
  if (len === 0) return '';
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Normalizes whatever the student typed (formatted US display, raw digits, or an already-E.164
 * value) into E.164. Returns null when it cannot be confidently parsed.
 */
export function toE164(rawInput: string, defaultCountryCode = '1'): string | null {
  const trimmed = rawInput.trim();
  if (trimmed.startsWith('+')) {
    const candidate = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    return E164_REGEX.test(candidate) ? candidate : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;
  const candidate = digits.length === 10 ? `+${defaultCountryCode}${digits}` : `+${digits}`;
  return E164_REGEX.test(candidate) ? candidate : null;
}

/** "+1 (312) 555-0100" for US/Canada numbers; other countries are returned with a country-code space. */
export function formatE164ForDisplay(e164: string): string {
  if (!isValidE164(e164)) return e164;
  if (e164.startsWith('+1') && e164.length === 12) {
    const digits = e164.slice(2);
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const match = /^\+(\d{1,3})(\d+)$/.exec(e164);
  return match ? `+${match[1]} ${match[2]}` : e164;
}
