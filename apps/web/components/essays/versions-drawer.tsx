'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { formatDraftSource } from '@/components/essays/format';
import { countWords } from '@/components/essays/word-count';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerTitle } from '@/components/system';
import { relativeTimeFromNow } from '@/lib/format';

// `EssayDraftDto`/`EssayFeedbackDto` are schemas (values) in the contract without matching
// exported types in apps/web's build graph, so the element types are derived from
// `EssayDetailDto` instead of importing them directly.
type EssayDraftDto = EssayDetailDto['drafts'][number];
type EssayFeedbackDto = EssayDetailDto['feedback'][number];

function draftsNewestFirst(drafts: EssayDraftDto[]): EssayDraftDto[] {
  return [...drafts].sort((a, b) => b.version - a.version);
}

export function VersionsDrawer({
  essay,
  open,
  onOpenChange,
  onRestore,
  onSelectFeedback,
}: {
  essay: EssayDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (content: string) => void;
  onSelectFeedback: (feedbackId: string) => void;
}) {
  const drafts = draftsNewestFirst(essay.drafts);
  const feedbackByDraft = new Map<string, EssayFeedbackDto[]>();
  for (const round of essay.feedback) {
    const existing = feedbackByDraft.get(round.essay_draft_id);
    if (existing) existing.push(round);
    else feedbackByDraft.set(round.essay_draft_id, [round]);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle>Versions</DrawerTitle>
        <DrawerBody>
          {drafts.length === 0 ? (
            <p className="text-14 text-fg-2">No versions saved yet. Your first autosave starts version 1.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {drafts.map((draft) => {
                const sourceWord = formatDraftSource(draft.source);
                const rounds = [...(feedbackByDraft.get(draft.id) ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return (
                  <div key={draft.id} className="flex flex-col gap-2 border-b border-line pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">Version {draft.version}</span>
                        <span className="text-14 text-fg-2">{countWords(draft.content)} words</span>
                        <span className="text-12 text-fg-3">
                          {relativeTimeFromNow(draft.created_at)}
                          {sourceWord ? `, ${sourceWord}` : ''}
                        </span>
                      </div>
                      <Button variant="text" size="sm" onClick={() => onRestore(draft.content)}>
                        Restore
                      </Button>
                    </div>
                    {rounds.length > 0 ? (
                      <div className="flex flex-col items-start gap-1 pl-4">
                        {rounds.map((round) => (
                          <Button key={round.id} variant="text" size="sm" className="h-auto px-0 text-12 text-fg-2" onClick={() => onSelectFeedback(round.id)}>
                            Feedback, {relativeTimeFromNow(round.created_at)}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
