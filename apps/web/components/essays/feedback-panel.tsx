'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import type { EssayFeedback } from '@apogee/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const TERMINAL_OUTCOMES = new Set(['completed', 'failed', 'refused', 'no_action']);

// `EssayFeedbackDto` is a schema (value) in the contract without a matching exported type, so the
// element type is derived from `EssayDetailDto['feedback']` instead of importing it directly.
type EssayFeedbackDto = EssayDetailDto['feedback'][number];

type Note = { quote: string | null; note: string };

function NoteList({ title, notes }: { title: string; notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {notes.map((note, index) => (
          <li key={index} className="rounded-md border border-border bg-muted/40 p-2 text-sm">
            {note.quote ? <p className="mb-1 italic text-muted-foreground">&ldquo;{note.quote}&rdquo;</p> : null}
            <p>{note.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERDICT_LABEL: Record<EssayFeedback['answers_prompt']['verdict'], string> = { yes: 'Yes', partially: 'Partially', no: 'No' };
const VERDICT_VARIANT: Record<EssayFeedback['answers_prompt']['verdict'], 'success' | 'warn' | 'urgent'> = { yes: 'success', partially: 'warn', no: 'urgent' };
const VOICE_LABEL: Record<EssayFeedback['voice_match']['matches'], string> = { yes: 'Sounds like you', mostly: 'Mostly sounds like you', no: "Doesn't sound like you yet" };

function FeedbackRound({ round, defaultOpen }: { round: EssayFeedbackDto; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const feedback = round.feedback;

  return (
    <div className="rounded-md border border-border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 p-3 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Badge variant={VERDICT_VARIANT[feedback.answers_prompt.verdict]}>Answers the prompt: {VERDICT_LABEL[feedback.answers_prompt.verdict]}</Badge>
          <span className="text-xs font-normal text-muted-foreground">{relativeTimeFromNow(round.created_at)}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border p-3 text-sm">
          <p className="text-muted-foreground">{feedback.answers_prompt.note}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Voice: {VOICE_LABEL[feedback.voice_match.matches]}</Badge>
            <Badge variant="outline">
              {feedback.word_count.current} words{feedback.word_count.limit ? ` / ${feedback.word_count.limit}` : ''}
            </Badge>
          </div>
          {feedback.voice_match.note ? <p className="text-muted-foreground">{feedback.voice_match.note}</p> : null}
          {feedback.word_count.note ? <p className="text-muted-foreground">{feedback.word_count.note}</p> : null}

          <NoteList title="Clarity" notes={feedback.clarity} />
          <NoteList title="Structure" notes={feedback.structure} />
          <NoteList title="Generic phrases" notes={feedback.generic_phrases} />
          <NoteList title="Where a real detail would be stronger" notes={feedback.where_a_real_detail_would_be_stronger} />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Top next steps</p>
            <ol className="list-decimal space-y-1 pl-4">
              {feedback.top_three_next_steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          {feedback.questions_to_ask_yourself.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Questions to ask yourself</p>
              <ul className="list-disc space-y-1 pl-4">
                {feedback.questions_to_ask_yourself.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FeedbackPanel({ essay }: { essay: EssayDetailDto }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [runId, setRunId] = useState<string | null>(null);
  const handledRunIdRef = useRef<string | null>(null);

  const requestFeedback = useMutation({
    mutationFn: () => clientApi.call('essayRequestFeedback', { params: { id: essay.id } }),
    onSuccess: (data) => setRunId(data.run_id),
    onError: () => toast({ title: 'Could not request feedback', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  const runQuery = useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => clientApi.call('agentRunGet', { params: { id: runId as string } }),
    enabled: runId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_OUTCOMES.has(query.state.data.outcome) ? false : 1500),
  });

  useEffect(() => {
    const run = runQuery.data;
    if (!run || !TERMINAL_OUTCOMES.has(run.outcome) || handledRunIdRef.current === run.id) return;
    handledRunIdRef.current = run.id;
    if (run.outcome === 'completed') {
      void queryClient.invalidateQueries({ queryKey: ['essay', essay.id] });
      toast({ title: 'Feedback is ready' });
    } else {
      toast({
        title: "Feedback isn't available right now",
        description: run.error ?? "Vector's model is unavailable at the moment — try again in a bit.",
        variant: 'destructive',
      });
    }
    setRunId(null);
  }, [runQuery.data, essay.id, queryClient, toast]);

  const isRunning = runId !== null && (!runQuery.data || !TERMINAL_OUTCOMES.has(runQuery.data.outcome));
  const rounds = [...essay.feedback].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Button type="button" onClick={() => requestFeedback.mutate()} loading={requestFeedback.isPending || isRunning} disabled={!essay.current_draft}>
          <Sparkles className="h-3.5 w-3.5" /> Get feedback
        </Button>
        <p className="text-xs text-muted-foreground">Feedback only — I&rsquo;ll never write or rewrite your sentences.</p>
        {!essay.current_draft ? <p className="text-xs text-muted-foreground">Write a draft first so there&rsquo;s something to react to.</p> : null}
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet — ask once you have a draft you&rsquo;d like a reaction to.</p>
      ) : (
        <div className="space-y-2">
          {rounds.map((round, index) => (
            <FeedbackRound key={round.id} round={round} defaultOpen={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
