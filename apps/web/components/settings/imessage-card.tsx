import { MessageCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ImessageCard({ agentName, agentPhone }: { agentName: string; agentPhone: string }) {
  const vcardHref = `/api/vcard?name=${encodeURIComponent(agentName)}&phone=${encodeURIComponent(agentPhone)}`;
  const smsHref = `sms:${agentPhone}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> Text {agentName}
        </CardTitle>
        <CardDescription>
          {agentName} at {agentPhone} — the same thread whether you text from your phone or send from the dashboard chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" asChild>
          <a href={smsHref}>Text {agentName}</a>
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href={vcardHref}>
            <Save className="h-3.5 w-3.5" /> Save contact
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
