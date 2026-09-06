'use client';

import type { EssayFeedback } from '@apogee/shared/schemas';
import { CircleNotch } from '@phosphor-icons/react';
import type { RefObject } from 'react';
import { AnchoredNotesColumn } from '@/components/essays/anchored-notes-column';
import { groupNotesByParagraph } from '@/components/essays/anchor-notes';
import type { EssayFeedbackState } from '@/components/essays/use-essay-feedback';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerTitle, DrawerTrigger, ErrorNote } from '@/components/system';
import { cn } from '@/lib/utils';

const VERDICT_LABEL: Record<EssayFeedback['answers_prompt']['verdict'], string> = { yes: 'yes', partially: 'partially', no: 'no' };
const VERDICT_CLASS: Record<EssayFeedback['answers_prompt']['verdict'], string> = { yes: 'text-ok', partially: 'text-heat-3', no: 'text-heat-5' };
const VOICE_LABEL: Record<EssayFeedback['voice_match']['matches'], string> = { yes: 'yes', mostly: 'mostly', no: 'no' };
const VOICE_CLASS: Record<EssayFeedback['voice_match']['matches'], string> = { yes: 'text-ok', mostly: 'text-heat-3', no: 'text-heat-5' };

function VerdictLines({ feedback }: { feedback: EssayFeedback }) {
  return (
    <div className="flex flex-col gap-1 text-14">
      <p>
        Answers the prompt: <span className={cn('font-medium', VERDICT_CLASS[feedback.answers_prompt.verdict])}>{VERDICT_LABEL[feedback.answers_prompt.verdict]}</span>
      </p>
      <p>
        Sounds like you: <span className={cn('font-medium', VOICE_CLASS[feedback.voice_match.matches])}>{VOICE_LABEL[feedback.voice_match.matches]}</span>
      </p>
    </div>
  );
}

function NextStepsAndQuestions({ feedback }: { feedback: EssayFeedback }) {
  return (
    <>
      <ol className="flex flex-col gap-1 pl-5 text-14">
        {feedback.top_three_next_steps.map((step, index) => (
          <li key={index} className="list-decimal">
            {step}
          </li>
        ))}
      </ol>
      {feedback.questions_to_ask_yourself.length > 0 ? (
        <ul className="flex flex-col gap-1 text-14 text-fg-2">
          {feedback.questions_to_ask_yourself.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function GeneralNotes({ notes }: { notes: EssayFeedbackState['general'] }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notes.map((note, index) => (
        <div key={index} className="group rounded bg-s1 p-3">
          <p className="text-12 text-fg-2">{note.categoryLabel}</p>
          <p className="text-14 text-fg">{note.note}</p>
          {note.quote ? <p className="mt-1 hidden text-12 italic text-fg-3 group-hover:block">&ldquo;{note.quote}&rdquo;</p> : null}
        </div>
      ))}
    </div>
  );
}

/** The request button, plus (once feedback exists) the verdict sentences and the next-steps and
 * questions lists — everything that's the same regardless of layout, and sits above the
 * per-paragraph notes in both of them. */
export function FeedbackHeader({ state, hasDraft }: { state: EssayFeedbackState; hasDraft: boolean }) {
  return (
    <>
      {/* Below `lg:` this stays the full-width bottom button it always was (the flex column it
          sits in stretches its children by default). At `lg:`, where it moves to the top of the
          margin column, `self-start` keeps it a normal content-width button instead of stretching
          to the column's full width. */}
      <Button variant="primary" className="lg:self-start" onClick={state.request} disabled={state.isBusy || !hasDraft} aria-busy={state.isBusy || undefined}>
        {state.isBusy ? (
          <>
            <CircleNotch className="animate-spin" aria-hidden />
            Reading your draft
          </>
        ) : (
          'Ask Vector for feedback'
        )}
      </Button>
      {state.runError ? <ErrorNote>{state.runError}</ErrorNote> : null}
      {state.feedback ? <VerdictLines feedback={state.feedback} /> : null}
      {state.feedback ? <NextStepsAndQuestions feedback={state.feedback} /> : null}
    </>
  );
}

/** Desktop margin column: general notes in normal flow, then the paragraph-anchored ones
 * positioned beside the paragraph they're about. */
export function FeedbackNotesDesktop({ state, editorRef }: { state: EssayFeedbackState; editorRef: RefObject<HTMLTextAreaElement | null> }) {
  return (
    <div className="flex flex-col gap-4">
      <GeneralNotes notes={state.general} />
      <AnchoredNotesColumn editorRef={editorRef} paragraphs={state.paragraphs} notes={state.anchored} />
    </div>
  );
}

/** Mobile: a text button naming how many notes there are, opening a bottom sheet that groups them
 * by paragraph (then "General") instead of positioning them in a margin that doesn't exist yet. */
export function FeedbackNotesMobile({ state }: { state: EssayFeedbackState }) {
  if (!state.feedback || state.placed.length === 0) return null;
  const groups = groupNotesByParagraph(state.placed);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="text" className="h-auto w-fit px-0">
          Feedback ({state.placed.length})
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle>Feedback</DrawerTitle>
        <DrawerBody>
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                <p className="text-12 font-medium text-fg-2">{group.label}</p>
                {group.notes.map((note, index) => (
                  <div key={index}>
                    <p className="text-12 text-fg-2">{note.categoryLabel}</p>
                    <p className="text-14 text-fg">{note.note}</p>
                    {note.quote ? <p className="mt-1 text-12 italic text-fg-3">&ldquo;{note.quote}&rdquo;</p> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
