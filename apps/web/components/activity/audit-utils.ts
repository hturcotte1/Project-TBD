/**
 * Pure helpers for the Activity/Audit page: turning a raw `audit_log.action` string into a
 * readable label, and turning a `details` JSON blob into a compact, safe key/value list.
 */

/** Every action string the API, worker and agent emit, as a plain sentence in the student's terms. */
const ACTION_LABELS: Record<string, string> = {
  'seed.demo_student': 'Set up the demo account',
  'sync.requested': 'Asked for a Common App sync',
  'sync.started': 'Started reading Common App',
  'sync.completed': 'Synced with Common App',
  'sync.failed': 'Sync failed',
  'sync.paused': 'Paused syncing',
  'sync_followup.sent': 'Texted you about what changed in the sync',
  'verify.connected': 'Confirmed the Common App login works',
  'welcome.sent': 'Sent the welcome text',
  'first_plan.sent': 'Sent your first plan',
  'weekly_plan.generated': 'Wrote the plan for the week',
  'proactive.sent': 'Texted you about something that needed you',
  'message.sent': 'Sent a message',
  'message.received': 'Received a message',
  'inbound.unknown_phone': 'Ignored a text from an unknown number',
  'agent.turn_failed': 'Could not finish a reply',
  'approval.proposed': 'Asked for your approval',
  'approval.created': 'Asked for your approval',
  'approval.approved': 'You approved a request',
  'approval.rejected': 'You rejected a request',
  'approval.expired': 'An approval request expired',
  'fill.proposed': 'Proposed filling in a field',
  'fill.completed': 'Filled in a field',
  'fill.verified': 'Verified a filled-in field',
  'fill.failed': 'Could not fill in a field',
  'fill.invalid_approval': 'Refused to fill without a valid approval',
  'fill.blocked_by_guard': 'Stopped short of a submit or payment step',
  'tool_origin_blocked': 'Blocked an unsafe action',
  'credentials.connected': 'Connected Common App',
  'credentials.disconnected': 'Disconnected Common App',
  'credentials.invalid': 'Common App login stopped working',
  'verification_code.requested': 'Asked for a verification code',
  'verification_code.received': 'You sent a verification code',
  'verification_code.submitted': 'You sent a verification code',
  'drift.detected': 'Noticed the Common App site changed',
  'drift.resolved': 'Resolved a site-change alert',
  'application.added': 'Added a school',
  'item.custom_added': 'You added a checklist item',
  'item.marked_done': 'Marked an item done',
  'item.snoozed': 'Snoozed an item',
  'next_actions.recomputed': 'Reordered your queue',
  'notifications.snoozed': 'Snoozed texts for a while',
  'quiet_hours.updated': 'Updated quiet hours',
  'recommender.status_updated': 'Updated a recommender status from Common App',
  'recommender.reminder_drafted': 'Drafted a recommender reminder',
  'reminder.drafted': 'Drafted a recommender reminder',
  'recommender.created': 'Added a recommender',
  'recommender.updated': 'Updated a recommender',
  'recommender.deleted': 'Removed a recommender',
  'document.extracted': 'Read an uploaded document',
  'document.extraction_failed': 'Could not read an uploaded document',
  'account.exported': 'Exported your data',
  'export.completed': 'Finished your data export',
  'account.deleted': 'Deleted your account',
  'narrative.summarized': 'Summarized your story',
  'essay.feedback_requested': 'Asked for essay feedback',
  'essay.feedback_generated': 'Gave feedback on an essay',
  'essay.draft_saved': 'Saved an essay draft',
  like: 'Reacted with a like',
  love: 'Reacted with a heart',
};

const BROWSER_JOB_LABELS: Record<string, string> = {
  verify_credentials: 'the Common App login check',
  full_sync: 'a full Common App sync',
  fill_fields: 'a fill of approved fields',
  check_recommenders: 'a recommender check',
};

/** `browser_job.<kind>.<outcome>` is built dynamically by the worker, so it is matched by shape. */
function browserJobLabel(action: string): string | null {
  const match = /^browser_job\.([a-z_]+)\.(succeeded|failed)$/.exec(action);
  if (!match) return null;
  const what = BROWSER_JOB_LABELS[match[1] ?? ''] ?? 'a browser job';
  return match[2] === 'succeeded' ? `Finished ${what}` : `Could not finish ${what}`;
}

/** Sentence-cases a dot/underscore/hyphen separated action string as a fallback. */
function sentenceFallback(action: string): string {
  const words = action.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return action;
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** "sync.completed" -> "Synced with Common App"; unknown actions fall back to a sentence-cased guess. */
export function humanizeAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? browserJobLabel(action) ?? sentenceFallback(action);
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
