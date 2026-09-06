'use client';

import type { StudentProfileDto } from '@apogee/shared/api';
import type { TranscriptExtraction } from '@apogee/shared/schemas';
import { CircleNotch, UploadSimple } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, ErrorNote, OkNote, toast } from '@/components/system';
import { useDocumentPoll } from '@/components/onboarding/use-document-poll';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

export function TranscriptUpload({ onApplied }: { onApplied: (profile: StudentProfileDto) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
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
    onError: () => toast('Could not upload that file. Try again.'),
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
    },
    onError: () => toast('Could not apply the transcript. Try again.'),
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
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <p className="text-14 text-fg-2">Drag a transcript here, or</p>
        <Button variant="text" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          <UploadSimple /> {doc ? 'Replace file' : 'Choose a file'}
        </Button>
      </div>

      {doc && doc.extraction_status !== 'done' && doc.extraction_status !== 'failed' ? (
        <p className="flex items-center gap-2 text-14 text-fg-2">
          <CircleNotch className="animate-spin" /> Reading your transcript
        </p>
      ) : null}

      {doc?.extraction_status === 'failed' ? <ErrorNote>Could not read that file. Fill in academics manually on the next screen.</ErrorNote> : null}

      {draft ? (
        <div className="flex flex-col gap-3 rounded border border-line px-3 py-3">
          <p className="text-12 text-fg-2">
            Extracted from your transcript{draft.school_name ? ` (${draft.school_name})` : ''}. Check it over on the next screen before it is saved.
          </p>
          {applied ? (
            <OkNote>Applied to your profile</OkNote>
          ) : (
            <Button variant="text" size="sm" className="h-auto w-fit px-0" onClick={() => apply.mutate()} loading={apply.isPending}>
              Apply to my profile
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
