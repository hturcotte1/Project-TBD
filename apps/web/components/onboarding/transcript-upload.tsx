'use client';

import type { StudentProfileDto } from '@apogee/shared/api';
import type { TranscriptExtraction } from '@apogee/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDocumentPoll } from '@/components/onboarding/use-document-poll';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

export function TranscriptUpload({ onApplied }: { onApplied: (profile: StudentProfileDto) => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [draft, setDraft] = useState<TranscriptExtraction | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => clientApi.upload('transcript', file),
    onSuccess: (doc) => {
      setDocumentId(doc.id);
      setApplied(false);
      setDraft(null);
    },
    onError: () => toast({ title: 'Could not upload that file — try again.', variant: 'destructive' }),
  });

  const poll = useDocumentPoll(documentId);
  const doc = poll.data;
  const extraction = doc?.extraction?.type === 'transcript' ? doc.extraction.data : null;

  useEffect(() => {
    if (doc?.extraction_status === 'done' && extraction && !draft) setDraft(extraction);
  }, [doc?.extraction_status, extraction, draft]);

  const apply = useMutation({
    mutationFn: () => {
      if (!documentId || !draft) throw new Error('nothing to apply');
      return clientApi.call('documentApplyTranscript', { params: { id: documentId }, body: draft });
    },
    onSuccess: (profile) => {
      setApplied(true);
      onApplied(profile);
      toast({ title: 'Applied to your profile', description: 'Review the fields below — you can still edit anything.' });
    },
    onError: () => toast({ title: 'Could not apply the transcript — try again.', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Upload your transcript</p>
            <p className="text-xs text-muted-foreground">Optional — we&rsquo;ll pull GPA, courses, and self-reported scores automatically.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
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
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your transcript…
          </p>
        ) : null}

        {doc?.extraction_status === 'failed' ? (
          <p className="text-xs text-destructive">Could not read that file. You can still fill in academics manually below.</p>
        ) : null}

        {draft ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Extracted from your transcript{draft.school_name ? ` (${draft.school_name})` : ''} — check it over before applying.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <ExtractedField label="Unweighted GPA" value={draft.academics.gpa_unweighted ?? null} />
              <ExtractedField label="Weighted GPA" value={draft.academics.gpa_weighted ?? null} />
              <ExtractedField label="Class rank" value={draft.academics.class_rank ?? null} />
              <ExtractedField label="Class size" value={draft.academics.class_size ?? null} />
            </div>
            {draft.courses.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Courses ({draft.courses.length})</p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {draft.courses.map((course, index) => (
                    <li key={`${course.name}-${index}`}>
                      {course.name}
                      {course.grade ? ` — ${course.grade}` : ''}
                      {course.level !== 'regular' ? ` (${course.level})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => apply.mutate()} loading={apply.isPending} disabled={applied}>
                {applied ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {applied ? 'Applied to your profile' : 'Apply to my profile'}
              </Button>
              {!applied ? <span className="text-xs text-muted-foreground">This fills in the fields below — you can still edit them.</span> : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExtractedField({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? '—'}</p>
    </div>
  );
}
