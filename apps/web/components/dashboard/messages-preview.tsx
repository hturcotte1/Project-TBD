import type { MessageDto } from '@apogee/shared/api';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { relativeTimeFromNow } from '@/lib/format';

export function MessagesPreview({ messages }: { messages: MessageDto[] }) {
  const recent = messages.slice(-3).reverse();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent messages</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/chat">Open chat</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {recent.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No messages yet"
            description="Text Vector or send a message from the chat page — replies show up here and over iMessage."
          />
        ) : (
          recent.map((message) => (
            <div key={message.id} className="space-y-0.5 text-sm">
              <p className="text-xs text-muted-foreground">
                {message.direction === 'outbound' ? 'Vector' : 'You'} · {relativeTimeFromNow(message.created_at)}
              </p>
              <p className="line-clamp-2">{message.body}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
