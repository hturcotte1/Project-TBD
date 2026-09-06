'use client';

import type { AgentRunDto } from '@apogee/shared/api';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerTitle, ErrorNote, Prose, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

const TERMINAL_RUN_OUTCOMES = new Set<AgentRunDto['outcome']>(['completed', 'failed', 'refused', 'no_action']);
const POLL_MS = 1500;

function draftTextFrom(run: AgentRunDto | undefined): string {
  const value = run?.metadata.draft_text;
  return typeof value === 'string' ? value : '';
}

export interface ReminderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommenderName: string;
  runId: string | null;
}

/** Vector's draft reminder, for the student to copy and send themselves — the agent never
 * contacts a recommender directly. Polls the run until it reaches a terminal outcome. */
export function ReminderDrawer({ open, onOpenChange, recommenderName, runId }: ReminderDrawerProps) {
  const runQuery = useQuery({
    queryKey: ['agent-run', runId],
    queryFn: () => clientApi.call('agentRunGet', { params: { id: runId as string } }),
    enabled: open && runId !== null,
    refetchInterval: (query) => (query.state.data && TERMINAL_RUN_OUTCOMES.has(query.state.data.outcome) ? false : POLL_MS),
  });

  const run = runQuery.data;
  const drafting = run === undefined || !TERMINAL_RUN_OUTCOMES.has(run.outcome);
  const failed = run !== undefined && run.outcome !== 'completed' && TERMINAL_RUN_OUTCOMES.has(run.outcome);
  const draftText = draftTextFrom(run);

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftText);
      toast('Copied.');
    } catch {
      toast('Could not copy. Select and copy the text yourself.');
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle>Reminder for {recommenderName}</DrawerTitle>
        <DrawerBody>
          {failed ? (
            <ErrorNote>Vector could not draft that. Try again in a minute.</ErrorNote>
          ) : drafting ? (
            <p className="text-14 text-fg-2">Vector is drafting a reminder.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Prose className="rounded bg-s2 p-4">
                <p className="whitespace-pre-wrap text-14">{draftText}</p>
              </Prose>
              <p className="text-12 text-fg-2">Send this from your own email or messages. Apogee never contacts your recommenders.</p>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!drafting && !failed ? (
            <Button variant="primary" onClick={() => void copyDraft()}>
              Copy
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
