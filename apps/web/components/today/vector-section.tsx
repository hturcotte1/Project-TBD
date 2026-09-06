import type { MessageDto } from '@apogee/shared/api';
import { Empty, Section, TextLink } from '@/components/system';
import { relativeTimeFromNow } from '@/lib/format';

export interface VectorSectionProps {
  /** The caller only mounts this once the query has resolved — see the loading rule in the spec. */
  messages: MessageDto[];
  agentName: string;
}

/** The last thing said in the main conversation, in either direction, with a link into the full
 * thread. Section title and empty-state copy use the student's actual agent name. */
export function VectorSection({ messages, agentName }: VectorSectionProps) {
  const last = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <Section title={agentName}>
      {!last ? (
        <Empty sentence="No messages yet." action={{ label: `Text ${agentName}`, href: '/chat' }} />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-14 text-fg">{last.direction === 'outbound' ? `“${last.body}”` : `You: ${last.body}`}</p>
            <p className="text-12 text-fg-3">{relativeTimeFromNow(last.created_at)}</p>
          </div>
          <TextLink href="/chat" className="shrink-0">
            {last.direction === 'outbound' ? 'Reply' : 'Open'}
          </TextLink>
        </div>
      )}
    </Section>
  );
}
