'use client';

import type { EssayDetailDto } from '@apogee/shared/api';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { RefObject } from 'react';
import { useAutosave } from '@/components/essays/use-autosave';
import type { AutosaveState } from '@/components/essays/use-autosave';
import { Textarea } from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

/** Autosaves `content` to the essay's current draft. Returns the autosave state so the caller
 * (the word gauge, positioned separately above the grid so it can span the full editor+margin
 * width) can show it without owning the save logic itself. */
export function useEssayAutosave(essay: EssayDetailDto, content: string): AutosaveState {
  const queryClient = useQueryClient();
  const save = useCallback(
    async (text: string) => {
      const updated = await clientApi.call('essaySaveDraft', { params: { id: essay.id }, body: { content: text, mode: 'autosave' } });
      queryClient.setQueryData(['essay', essay.id], updated);
    },
    [essay.id, queryClient],
  );
  return useAutosave({ content, save });
}

export function EssayEditor({
  content,
  onChange,
  textareaRef,
  className,
}: {
  content: string;
  onChange: (text: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  return (
    <Textarea
      ref={textareaRef}
      value={content}
      onChange={(event) => onChange(event.target.value)}
      autoResize
      placeholder="Start writing."
      className={cn('min-h-[50vh] max-w-measure border-0 bg-transparent text-14 leading-[1.6] lg:text-17', className)}
    />
  );
}
