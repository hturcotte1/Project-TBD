/**
 * Pure helpers for the Activity/Audit page: turning a raw `audit_log.action` string into a
 * readable label, and turning a `details` JSON blob into a compact, safe key/value list.
 */

/** Known action strings get a specific, plain-language label. */
const ACTION_LABELS: Record<string, string> = {
  'sync.started': 'Started syncing with Common App',
  'sync.completed': 'Synced with Common App',
  'sync.failed': 'Sync failed',
  'message.sent': 'Sent a message',
  'message.received': 'Received a message',
  'approval.created': 'Asked for your approval',
  'approval.approved': 'You approved a request',
  'approval.rejected': 'You rejected a request',
  'approval.expired': 'An approval request expired',
  'fill.proposed': 'Proposed filling in a field',
  'fill.completed': 'Filled in a field',
  'fill.verified': 'Verified a filled-in field',
  'fill.failed': 'Could not fill in a field',
  'tool_origin_blocked': 'Blocked an unsafe action',
  'credentials.connected': 'Connected Common App',
  'credentials.disconnected': 'Disconnected Common App',
  'credentials.invalid': 'Common App login stopped working',
  'verification_code.requested': 'Asked for a verification code',
  'verification_code.submitted': 'You sent a verification code',
  'drift.detected': 'Noticed the Common App site changed',
  'drift.resolved': 'Resolved a site-change alert',
  'recommender.reminder_drafted': 'Drafted a recommender reminder',
  'recommender.created': 'Added a recommender',
  'recommender.updated': 'Updated a recommender',
  'recommender.deleted': 'Removed a recommender',
  'account.exported': 'Exported your data',
  'account.deleted': 'Deleted your account',
  'narrative.summarized': 'Summarized your story',
  'essay.feedback_requested': 'Asked for essay feedback',
};

/** Title-cases a dot/underscore/hyphen separated action string as a fallback. */
function titleCaseFallback(action: string): string {
  const words = action
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(' ') || action;
}

/** "sync.completed" -> "Synced with Common App"; unknown actions fall back to a title-cased guess. */
export function humanizeAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? titleCaseFallback(action);
}

export interface DetailEntry {
  key: string;
  value: string;
}

/**
 * Keys that must never render their raw value on screen — credentials, verification codes, and
 * essay/message text. Matched as a plain case-insensitive substring (not a `\b`-bounded regex,
 * since snake_case keys like `message_body` or `essay_id` have underscores — a word character —
 * on both sides of the interesting part, so `\b` would never find a boundary there) against every
 * key, so `essay_body`, `message_body`, and `Verification_Code` are all caught. A legitimate id
 * like `essay_id` is the one deliberate exception: it ends in `_id`, not one of these terms.
 */
const SENSITIVE_KEY_TERMS = ['password', 'passwd', 'secret', 'token', 'credential', 'cookie', 'code', 'essay', 'draft', 'body', 'content', 'text'];
const ID_SUFFIX_PATTERN = /_id$/i;

function isSensitiveKey(key: string): boolean {
  if (ID_SUFFIX_PATTERN.test(key)) return false;
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEY_TERMS.some((term) => lowerKey.includes(term));
}

const MAX_VALUE_LENGTH = 200;

function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
}

function stringifyDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return '—';
  }
}

/** Turns an audit entry's `details` object into a compact, redacted key/value list for display. */
export function redactDetails(details: Record<string, unknown>): DetailEntry[] {
  return Object.entries(details).map(([key, value]) => ({
    key,
    value: isSensitiveKey(key) ? '[redacted]' : stringifyDetailValue(value),
  }));
}
