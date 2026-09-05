'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { ApiError } from '@apogee/shared/api';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useAutosave } from '@/components/essays/use-autosave';
import { countWords, wordCountLabel, wordProgressPercent } from '@/components/essays/word-count';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { formatTime } from '@/lib/format';

const AUTOSAVE_STATUS_LABEL = {
  saved: 'saved',
  pending: 'saving',
  saving: 'saving',
  offline: 'offline',
} as const;

export function EditorPanel({ essay, content, onChange, timezone }: { essay: EssayDetailDto; content: string; onChange: (text: string) => void; timezone: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [savingVersion, setSavingVersion] = useState(false);

  const autosave = useCallback(
    async (text: string) => {
      const updated = await clientApi.call('essaySaveDraft', { params: { id: essay.id }, body: { content: text, mode: 'autosave' } });
      queryClient.setQueryData(['essay', essay.id], updated);
    },
    [essay.id, queryClient],
  );

  const autosaveState = useAutosave({ content, save: autosave });

  async function saveAsVersion() {
    setSavingVersion(true);
    try {
      const updated = await clientApi.call('essaySaveDraft', { params: { id: essay.id }, body: { content, mode: 'version' } });
      queryClient.setQueryData(['essay', essay.id], updated);
      toast({ title: 'Version saved', description: `v${updated.current_draft?.version ?? ''} is on the record now.` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Try again in a moment.';
      toast({ title: 'Could not save that version', description: message, variant: 'destructive' });
    } finally {
      setSavingVersion(false);
    }
  }

  const count = countWords(content);
  const percent = wordProgressPercent(count, essay.word_limit);
  const statusKey = AUTOSAVE_STATUS_LABEL[autosaveState.status];
  const statusText = statusKey === 'offline' ? 'Offline — will retry' : statusKey === 'saving' ? 'Saving…' : autosaveState.savedAt ? `Saved · ${formatTime(autosaveState.savedAt.toISOString(), timezone)}` : 'Saved';

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        rows={16}
        placeholder="Write here — this is your own writing, in your own words."
        className="font-serif text-base leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{wordCountLabel(count, essay.word_limit)}</span>
        <span className={statusKey === 'offline' ? 'text-urgent' : ''}>{statusText}</span>
      </div>
      {percent !== null ? <Progress value={percent} className="h-1.5" /> : null}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={saveAsVersion} loading={savingVersion}>
          Save as new version
        </Button>
      </div>
    </div>
  );
}
