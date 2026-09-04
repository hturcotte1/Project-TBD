'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { cn } from '@/lib/utils';

const NOTES_MAX_LENGTH = 2000;

/**
 * Small notes editor for one checklist item. Built directly on `@radix-ui/react-popover` (already
 * a project dependency) rather than adding a shared `ui/popover.tsx` wrapper, since this is the
 * only place on these pages that needs one.
 */
export function ItemNotesPopover({ itemId, notes, applicationId }: { itemId: string; notes: string; applicationId: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes);

  const save = useMutation({
    mutationFn: (nextNotes: string) => clientApi.call('itemUpdate', { params: { id: itemId }, body: { notes: nextNotes } }),
    onSuccess: () => {
      if (applicationId) void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      setOpen(false);
    },
    onError: () => toast({ title: 'Could not save that note', description: 'Try again in a moment.', variant: 'destructive' }),
  });

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(notes);
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8', notes ? 'text-primary' : 'text-muted-foreground')} aria-label="Edit notes">
          <StickyNote className="h-4 w-4" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 space-y-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <p className="text-xs font-medium text-muted-foreground">Your notes</p>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={NOTES_MAX_LENGTH}
            rows={3}
            placeholder="Add a note for yourself…"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" loading={save.isPending} onClick={() => save.mutate(draft)}>
              Save
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
