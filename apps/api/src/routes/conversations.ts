import { conversationsRepo, messagesRepo } from '@apogee/shared/db';
import { jobIds } from '@apogee/shared/jobs';
import { mapMessage } from '../mappers';
import { authed, type Handlers } from './contract';

export const conversationHandlers: Pick<Handlers, 'messagesList' | 'messageSend'> = {
  messagesList: authed(async ({ sdb, params, query }) => {
    const conversation = await conversationsRepo.getOrCreate(sdb, params.kind);
    const after = query.after ? new Date(query.after) : null;
    const rows = await messagesRepo.after(sdb, conversation.id, after, query.limit);
    return rows.map((r) => mapMessage(r, params.kind));
  }),

  messageSend: authed(async ({ auth, sdb, deps, params, body }) => {
    const conversation = await conversationsRepo.getOrCreate(sdb, params.kind);
    const message = await messagesRepo.append(sdb, {
      conversationId: conversation.id,
      channel: 'dashboard',
      direction: 'inbound',
      kind: 'text',
      body: body.body,
    });
    await deps.enqueuer.enqueue(
      'agent.inbound_message',
      { studentId: auth.studentId, messageId: message.id, conversationKind: params.kind },
      { jobId: jobIds.inbound(message.id) },
    );
    return mapMessage(message, params.kind);
  }),
};
