'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { relativeTimeFromNow } from '@/lib/format';
import { cn } from '@/lib/utils';

// `EssayDraftDto` is a schema (value) in the contract without a matching exported type, so the
// element type is derived from `EssayDetailDto['drafts']` instead of importing it directly.
type EssayDraftDto = EssayDetailDto['drafts'][number];

export function VersionList({ drafts, onRestore }: { drafts: EssayDraftDto[]; onRestore: (text: string) => void }) {
  const [viewing, setViewing] = useState<EssayDraftDto | null>(null);
  const sorted = [...drafts].sort((a, b) => a.version - b.version);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No versions saved yet — your first autosave will start v1.</p>;
  }

  return (
    <>
      <ul className="space-y-1.5">
        {sorted.map((draft) => (
          <li key={draft.id}>
            <button
              type="button"
              onClick={() => setViewing(draft)}
              className={cn('flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent')}
            >
              <span className="font-medium">v{draft.version}</span>
              <span className="text-xs text-muted-foreground">
                {draft.word_count} words · {relativeTimeFromNow(draft.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  v{viewing.version} · {viewing.word_count} words
                </DialogTitle>
              </DialogHeader>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/50 p-3 text-sm">{viewing.content}</p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewing(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onRestore(viewing.content);
                    setViewing(null);
                  }}
                >
                  Restore into editor
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
