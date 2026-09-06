'use client';

import { PaperPlaneRight } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Textarea, toast } from '@/components/system';
import { clientApi } from '@/lib/api.client';

/** Caps the auto-growing textarea at roughly 5 lines of text-14 (20px line height, 16px vertical
 * padding, 2px border) before it scrolls internally instead of pushing the thread further up. */
const MAX_TEXTAREA_HEIGHT_PX = 118;

export interface ComposerProps {
  onSent: () => void;
}

export function Composer({ onSent }: ComposerProps) {
  const [draft, setDraft] = useState('');

  const send = useMutation({
    mutationFn: (body: string) => clientApi.call('messageSend', { params: { kind: 'main' }, body: { body } }),
    onSuccess: () => {
      setDraft('');
      onSent();
    },
    onError: () => toast('Could not send. Try again.'),
  });

  function submit() {
    const trimmed = draft.trim();
    if (trimmed) send.mutate(trimmed);
  }

  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          autoResize
          rows={1}
          maxLength={5000}
          placeholder="Text Vector"
          className="flex-1 bg-s2"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT_PX }}
        />
        <Button type="submit" variant="primary" iconOnly aria-label="Send" disabled={!draft.trim() || send.isPending} loading={send.isPending}>
          <PaperPlaneRight />
        </Button>
      </form>
      <p className="hidden text-12 text-fg-3 lg:block">The same thread as your iMessages.</p>
    </div>
  );
}
