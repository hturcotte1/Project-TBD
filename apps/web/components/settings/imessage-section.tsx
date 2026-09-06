import { Section, TextLink } from '@/components/system';
import { formatUsPhoneAsYouType } from '@/lib/phone';

export function ImessageSection({ agentName, agentPhone }: { agentName: string; agentPhone: string }) {
  const vcardHref = `/api/vcard?name=${encodeURIComponent(agentName)}&phone=${encodeURIComponent(agentPhone)}`;
  const smsHref = `sms:${agentPhone}`;

  return (
    <Section title={`${agentName} on iMessage`}>
      <p className="text-14 text-fg">
        Text {agentName} at {formatUsPhoneAsYouType(agentPhone)}. It is the same thread as the {agentName} page.
      </p>
      <div className="flex flex-wrap gap-4">
        <TextLink href={vcardHref}>Save contact</TextLink>
        <TextLink href={smsHref}>Open Messages</TextLink>
      </div>
    </Section>
  );
}
