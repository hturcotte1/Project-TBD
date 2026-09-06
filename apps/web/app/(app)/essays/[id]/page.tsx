'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useQuery } from '@tanstack/react-query';
import { CaretLeft } from '@phosphor-icons/react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { countWords } from '@/components/essays/word-count';
import { EssayEditor, useEssayAutosave } from '@/components/essays/essay-editor';
import { formatDueDate } from '@/components/essays/format';
import { EssayPrompt } from '@/components/essays/essay-prompt';
import { FeedbackHeader, FeedbackNotesDesktop, FeedbackNotesMobile } from '@/components/essays/feedback-panel';
import { useEssayFeedback } from '@/components/essays/use-essay-feedback';
import { VersionsDrawer } from '@/components/essays/versions-drawer';
import { WordGauge } from '@/components/essays/word-gauge';
import { Button, DaysFigure, ErrorNote, TextLink } from '@/components/system';
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

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const essay = essayQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Same Bricolage warm-up as the essays list page — see the comment there. */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <TextLink href="/essays" className="flex w-fit items-center gap-1 text-12">
        <CaretLeft /> Essays
      </TextLink>

      {essayQuery.isError ? (
        <ErrorNote>
          Could not load this essay.{' '}
          <Button variant="text" className="h-auto px-0" onClick={() => essayQuery.refetch()}>
            Try again
          </Button>
        </ErrorNote>
      ) : essay && initialized ? (
        <EssayDetail
          essay={essay}
          timezone={timezone}
          content={content}
          setContent={setContent}
          textareaRef={textareaRef}
          versionsOpen={versionsOpen}
          setVersionsOpen={setVersionsOpen}
          selectedFeedbackId={selectedFeedbackId}
          setSelectedFeedbackId={setSelectedFeedbackId}
        />
      ) : null}
    </div>
  );
}

// A non-null `essay` is required from here down (the autosave and feedback hooks both need it),
// so this splits out of the page component instead of guarding every hook call above with an if.
function EssayDetail({
  essay,
  timezone,
  content,
  setContent,
  textareaRef,
  versionsOpen,
  setVersionsOpen,
  selectedFeedbackId,
  setSelectedFeedbackId,
}: {
  essay: EssayDetailDto;
  timezone: string;
  content: string;
  setContent: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  versionsOpen: boolean;
  setVersionsOpen: (open: boolean) => void;
  selectedFeedbackId: string | null;
  setSelectedFeedbackId: (id: string | null) => void;
}) {
  const autosave = useEssayAutosave(essay, content);
  const feedback = useEssayFeedback(essay, selectedFeedbackId, () => setSelectedFeedbackId(null));

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-22 font-semibold lg:text-28">{essay.title}</h1>
          <Button variant="text" size="sm" onClick={() => setVersionsOpen(true)}>
            Versions ({essay.drafts.length})
          </Button>
        </div>
        <p className="text-14 text-fg-2">
          {essay.school_name ? (
            <>
              {essay.school_name}
              {essay.due_date ? (
                <>
                  , due {formatDueDate(essay.due_date, timezone)} <DaysFigure days={essay.days_remaining} format="relative" />
                </>
              ) : null}
            </>
          ) : (
            'Personal essay, shared by every school'
          )}
        </p>
      </div>

      <EssayPrompt prompt={essay.prompt} />

      {/*
        A single grid carries the whole feedback layout so the editor and the right margin column
        stay vertically aligned. Below `lg` there's only one implicit column, so these three items
        (plus the mobile sheet trigger) simply stack in DOM order: gauge, editor, the request
        button with its verdict/next-steps summary, then the feedback sheet. At `lg:`, the gauge
        spans both columns as its own row (nothing else may share it, so the textarea starts right
        underneath), and the next two items in DOM order — the editor, then the margin column —
        fill the row beneath it side by side. No explicit `order` is needed: DOM order already
        matches the wanted layout at both widths.
      */}
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,64ch)_280px]">
        <WordGauge count={countWords(content)} limit={essay.word_limit} autosaveStatus={autosave.status} className="lg:col-span-2" />
        <EssayEditor content={content} onChange={setContent} textareaRef={textareaRef} />
        {/* Right margin column at `lg:`: the request button and its summary (verdicts, next
            steps, questions) come first, above the anchored notes — the reverse of the button's
            position below `lg`, where it trails the editor as the "bottom button" ahead of the
            feedback sheet. The desktop notes are hidden below `lg:` (the sheet covers that case),
            nested here rather than as a sibling grid item so they stay stacked under the summary
            in the same column instead of claiming a row of their own. */}
        <div className="flex flex-col gap-4">
          <FeedbackHeader state={feedback} hasDraft={essay.current_draft !== null} />
          <div className="hidden lg:block">
            <FeedbackNotesDesktop state={feedback} editorRef={textareaRef} />
          </div>
        </div>
        <div className="lg:hidden">
          <FeedbackNotesMobile state={feedback} />
        </div>
      </div>

      <VersionsDrawer
        essay={essay}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestore={(text) => {
          setContent(text);
          setVersionsOpen(false);
        }}
        onSelectFeedback={(id) => {
          setSelectedFeedbackId(id);
          setVersionsOpen(false);
        }}
      />
    </>
  );
}
