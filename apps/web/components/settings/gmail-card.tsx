import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function GmailCard({ enabled }: { enabled: boolean }) {
  return (
    <Card className={enabled ? undefined : 'opacity-70'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Gmail
        </CardTitle>
        <CardDescription>
          {enabled ? 'Read-only access so Vector can catch recommender and portal emails.' : 'Coming soon — read-only access so Vector can catch recommender and portal emails.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" disabled>
          {enabled ? 'Connect Gmail' : 'Coming soon'}
        </Button>
      </CardContent>
    </Card>
  );
}
