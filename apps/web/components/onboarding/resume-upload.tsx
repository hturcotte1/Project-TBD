'use client';

import type { ActivityInput } from '@tbd/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDocumentPoll } from '@/components/onboarding/use-document-poll';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function ResumeUpload({ onApplied }: { onApplied: (activities: ActivityInput[]) => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => clientApi.upload('resume', file),
    onSuccess: (doc) => {
      setDocumentId(doc.id);
      setApplied(false);
    },
    onError: () => toast({ title: 'Could not upload that file — try again.', variant: 'destructive' }),
  });

  const poll = useDocumentPoll(documentId);
  const doc = poll.data;
  const extraction = doc?.extraction?.type === 'resume' ? doc.extraction.data : null;

  const apply = useMutation({
    mutationFn: () => {
      if (!documentId || !extraction) throw new Error('nothing to apply');
      return clientApi.call('documentApplyActivities', { params: { id: documentId }, body: { activities: extraction.activities } });
    },
    onSuccess: (saved) => {
      setApplied(true);
      onApplied([...saved].sort((a, b) => a.order - b.order).map(({ id: _id, order: _order, ...rest }) => rest));
      toast({ title: 'Activities updated', description: 'Reorder, edit, or remove anything below before continuing.' });
    },
    onError: () => toast({ title: 'Could not apply those activities — try again.', variant: 'destructive' }),
  });

  useEffect(() => {
    setApplied(false);
  }, [documentId]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Upload your resume</p>
            <p className="text-xs text-muted-foreground">Optional — we&rsquo;ll turn it into a first draft of your activities list.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
            <Upload className="h-3.5 w-3.5" /> {doc ? 'Replace' : 'Upload'}
          </Button>
        </div>

        {doc && doc.extraction_status !== 'done' && doc.extraction_status !== 'failed' ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your resume…
          </p>
        ) : null}

        {doc?.extraction_status === 'failed' ? <p className="text-xs text-destructive">Could not read that file. Add activities manually below.</p> : null}

        {extraction ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Found {extraction.activities.length} activit{extraction.activities.length === 1 ? 'y' : 'ies'}
              {extraction.dropped.length > 0 ? ` (${extraction.dropped.length} more couldn't fit Common App's 10-activity limit)` : ''}. Using these replaces the
              list below.
            </p>
            <Button type="button" size="sm" onClick={() => apply.mutate()} loading={apply.isPending} disabled={applied}>
              {applied ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {applied ? 'Applied below' : 'Use these activities'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
