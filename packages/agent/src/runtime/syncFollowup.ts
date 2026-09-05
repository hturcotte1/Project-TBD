import { eq } from 'drizzle-orm';
import { appendAudit, AuthorizationError, conversationsRepo, messagesRepo, nudgesRepo, scoped, studentsRepo } from '@apogee/shared/db';
import * as S from '@apogee/shared/db/schema';
import type { StateChange } from '@apogee/shared/schemas';
import { isQuietNow } from '@apogee/shared/time';
import type { AgentDeps } from './deps';

export interface RunSyncFollowupInput {
  studentId: string;
  snapshotId: string;
  browserJobId: string;
}

function summarizeChanges(changes: StateChange[]): string {
  return changes.slice(0, 3).map((c) => c.summary).join(' ');
}

/** Texts the student a concrete summary when a sync found anything worth hearing about. */
export async function runSyncFollowup(deps: AgentDeps, input: RunSyncFollowupInput): Promise<{ sent: boolean }> {
  const sdb = scoped(deps.db, input.studentId);
  const snapshot = await sdb.requireOne(S.commonAppSnapshots, eq(S.commonAppSnapshots.id, input.snapshotId));
  const important = snapshot.diff.filter((c) => c.significance === 'important');
  const notable = snapshot.diff.filter((c) => c.significance === 'notable');
  if (important.length === 0 && notable.length < 3) return { sent: false };

  const student = await studentsRepo.findById(deps.db, input.studentId);
  if (!student) throw new AuthorizationError();
  if (!student.phoneE164) return { sent: false };
  const now = deps.clock.now();
  if (isQuietNow(now, student.timezone, { start: student.quietHoursStart, end: student.quietHoursEnd })) return { sent: false };

  const changesToReport = important.length > 0 ? important : notable;
  const text = `Common App update: ${summarizeChanges(changesToReport)}`.slice(0, 500);

  const conversation = await conversationsRepo.getOrCreate(sdb, 'main');
  const result = await deps.messaging.send({ to: student.phoneE164, body: text });
  const row = await messagesRepo.append(sdb, {
    conversationId: conversation.id,
    channel: 'imessage',
    direction: 'outbound',
    body: text,
    providerMessageId: result.providerMessageId,
    deliveryStatus: result.status,
    proactive: true,
  });

  await nudgesRepo.recordSent(sdb, { kind: 'sync_change', triggerKey: `sync_change:${input.snapshotId}`, messageId: row.id });
  await appendAudit(sdb, {
    actor: 'agent',
    action: 'sync_followup.sent',
    entityType: 'common_app_snapshot',
    entityId: input.snapshotId,
    details: { browserJobId: input.browserJobId },
  });
  return { sent: true };
}
