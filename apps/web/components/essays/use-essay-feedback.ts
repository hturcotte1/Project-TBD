'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { placeNotes, splitParagraphs } from '@/components/essays/anchor-notes';
import { toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

// `EssayFeedbackDto` is a schema (value) in the contract without a matching exported type in
// apps/web's build graph, so the element type is derived from `EssayDetailDto` instead of
// importing it directly (same workaround the old version-list/feedback-panel used).
type EssayFeedbackDto = EssayDetailDto['feedback'][number];

const TERMINAL_OUTCOMES = new Set(['completed', 'failed', 'refused', 'no_action']);
export const DEFAULT_FEEDBACK_ERROR = 'Vector could not review this draft. Try again in a minute.';

function latestRoundsDescending(feedback: EssayFeedbackDto[]): EssayFeedbackDto[] {
  return [...feedback].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/**
 * Owns the "Ask Vector for feedback" request, polls its agent run to completion, and resolves
 * which round is active (the latest, or one picked from the versions drawer) into the paragraphs
 * it was given on and the notes anchored against them. One call per essay page — the desktop
 * margin column, the mobile drawer, and the shared verdict/steps text all read from the same
 * instance instead of racing independent requests.
 */
export function useEssayFeedback(essay: EssayDetailDto, selectedFeedbackId: string | null, onNewFeedback: () => void) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const handledRunIdRef = useRef<string | null>(null);

  const requestFeedback = useMutation({
    mutationFn: () => clientApi.call('essayRequestFeedback', { params: { id: essay.id } }),
    onSuccess: (data) => {
      setRunError(null);
      setRunId(data.run_id);
    },
    onError: () => setRunError(DEFAULT_FEEDBACK_ERROR),
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
      toast('Feedback is in.');
      onNewFeedback();
    } else {
      setRunError(run.error ?? DEFAULT_FEEDBACK_ERROR);
    }
    setRunId(null);
  }, [runQuery.data, essay.id, queryClient, onNewFeedback]);

  const isBusy = requestFeedback.isPending || (runId !== null && (!runQuery.data || !TERMINAL_OUTCOMES.has(runQuery.data.outcome)));

  const rounds = latestRoundsDescending(essay.feedback);
  const activeRound = selectedFeedbackId ? (rounds.find((round) => round.id === selectedFeedbackId) ?? rounds[0]) : rounds[0];
  const feedback = activeRound?.feedback ?? null;
  const draftForRound = activeRound ? (essay.drafts.find((draft) => draft.id === activeRound.essay_draft_id) ?? essay.current_draft) : essay.current_draft;
  const paragraphs = splitParagraphs(draftForRound?.content ?? '');
  const placed = feedback
    ? placeNotes(paragraphs, {
        clarity: feedback.clarity,
        structure: feedback.structure,
        generic_phrase: feedback.generic_phrases,
        real_detail: feedback.where_a_real_detail_would_be_stronger,
      })
    : [];
  const anchored = placed.filter((note) => note.paragraphIndex !== null);
  const general = placed.filter((note) => note.paragraphIndex === null);

  return {
    request: () => requestFeedback.mutate(),
    isBusy,
    runError,
    feedback,
    paragraphs,
    placed,
    anchored,
    general,
  };
}

export type EssayFeedbackState = ReturnType<typeof useEssayFeedback>;
