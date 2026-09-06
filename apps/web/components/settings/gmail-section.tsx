import { Button, Section } from '@/components/system';

export function GmailSection({ enabled }: { enabled: boolean }) {
  return (
    <Section title="Gmail">
      <p className="text-14 text-fg-2">{enabled ? 'Read-only access so Vector can catch recommender and portal emails.' : 'Not connected. Gmail reading is off for this account.'}</p>
      <Button variant="text" className="h-auto px-0" disabled>
        {enabled ? 'Connect Gmail' : 'Coming soon'}
      </Button>
    </Section>
  );
}
