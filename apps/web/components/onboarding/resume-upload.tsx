'use client';

import type { ActivityInput } from '@apogee/shared/schemas';
import { CircleNotch, UploadSimple } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, ErrorNote, OkNote, toast } from '@/components/system';
import { useDocumentPoll } from '@/components/onboarding/use-document-poll';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

export function ResumeUpload({ onApplied }: { onApplied: (activities: ActivityInput[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => clientApi.upload('resume', file),
    onSuccess: (doc) => {
      setDocumentId(doc.id);
      setApplied(false);
    },
    onError: () => toast('Could not upload that file. Try again.'),
  });

  const poll = useDocumentPoll(documentId);
  const doc = poll.data;
  const extraction = doc?.extraction?.type === 'resume' ? doc.extraction.data : null;

  useEffect(() => {
    setApplied(false);
  }, [documentId]);

  const apply = useMutation({
    mutationFn: () => {
      if (!documentId || !extraction) throw new Error('nothing to apply');
      return clientApi.call('documentApplyActivities', { params: { id: documentId }, body: { activities: extraction.activities } });
    },
    onSuccess: (saved) => {
      setApplied(true);
      onApplied([...saved].sort((a, b) => a.order - b.order).map(({ id: _id, order: _order, ...rest }) => rest));
    },
    onError: () => toast('Could not apply those activities. Try again.'),
  });

  function handleFile(file: File | undefined) {
    if (file) upload.mutate(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn('flex flex-col items-center gap-2 rounded border border-dashed border-line-strong px-4 py-8 text-center', dragOver && 'bg-s2')}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <p className="text-14 text-fg-2">Drag a resume here, or</p>
        <Button variant="text" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          <UploadSimple /> {doc ? 'Replace file' : 'Choose a file'}
        </Button>
      </div>

      {doc && doc.extraction_status !== 'done' && doc.extraction_status !== 'failed' ? (
        <p className="flex items-center gap-2 text-14 text-fg-2">
          <CircleNotch className="animate-spin" /> Reading your resume
        </p>
      ) : null}

      {doc?.extraction_status === 'failed' ? <ErrorNote>Could not read that file. Add activities manually on the next screen.</ErrorNote> : null}

      {extraction ? (
        <div className="flex flex-col gap-3 rounded border border-line px-3 py-3">
          <p className="text-12 text-fg-2">
            Found {extraction.activities.length} activit{extraction.activities.length === 1 ? 'y' : 'ies'}
            {extraction.dropped.length > 0 ? ` (${extraction.dropped.length} more couldn't fit Common App's 10-activity limit)` : ''}. Using these replaces
            the list on the next screen.
          </p>
          {applied ? (
            <OkNote>Applied</OkNote>
          ) : (
            <Button variant="text" size="sm" className="h-auto w-fit px-0" onClick={() => apply.mutate()} loading={apply.isPending}>
              Use these activities
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
