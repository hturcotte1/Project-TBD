'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EditorPanel } from '@/components/essays/editor-panel';
import { FeedbackPanel } from '@/components/essays/feedback-panel';
import { PromptPanel } from '@/components/essays/prompt-panel';
import { VersionList } from '@/components/essays/version-list';
import { Skeleton } from '@/components/ui/skeleton';
import { clientApi } from '@/lib/api.client';

export default function EssayDetailPage() {
  const params = useParams<{ id: string }>();
  const essayId = params.id;

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => clientApi.call('me') });
  const essayQuery = useQuery({ queryKey: ['essay', essayId], queryFn: () => clientApi.call('essayGet', { params: { id: essayId } }) });

  const timezone = meQuery.data?.timezone ?? 'America/Chicago';

  // Seed the editor from the fetched draft exactly once per essay id — later refetches (autosave
  // responses, feedback completing) must never clobber text the student is actively typing.
  const [content, setContent] = useState('');
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!essayQuery.data || initializedForRef.current === essayId) return;
    initializedForRef.current = essayId;
    setContent(essayQuery.data.current_draft?.content ?? '');
  }, [essayQuery.data, essayId]);
  const initialized = initializedForRef.current === essayId;

  return (
    <div className="space-y-6 px-4 py-5 pb-8 sm:px-6">
      <Link href="/essays" className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All essays
      </Link>

      {essayQuery.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : essayQuery.isError ? (
        <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Could not load this essay — try refreshing.</p>
      ) : essayQuery.data ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">{essayQuery.data.title}</h1>
          <PromptPanel essay={essayQuery.data} timezone={timezone} />

          {initialized ? <EditorPanel essay={essayQuery.data} content={content} onChange={setContent} timezone={timezone} /> : <Skeleton className="h-64 w-full" />}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Versions</h2>
            <VersionList drafts={essayQuery.data.drafts} onRestore={setContent} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Feedback</h2>
            <FeedbackPanel essay={essayQuery.data} />
          </section>
        </>
      ) : null}
    </div>
  );
}
