'use client';

import { useState } from 'react';
import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerTitle, Textarea } from '@/components/system';

export interface NotesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  notes: string;
  onSave: (notes: string) => void;
  saving: boolean;
}

/** A note editor for one school or checklist item — a Drawer with a single Textarea, shared by
 * both "Add a note" menu actions on the school detail page. */
export function NotesDrawer({ open, onOpenChange, title, notes, onSave, saving }: NotesDrawerProps) {
  const [draft, setDraft] = useState(notes);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(notes);
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerTitle>{title}</DrawerTitle>
        <DrawerBody>
          <Textarea
            autoResize
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            placeholder="Add a note for yourself"
          />
        </DrawerBody>
        <DrawerFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="text" loading={saving} onClick={() => onSave(draft)}>
            Save note
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
