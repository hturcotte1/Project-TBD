import type { ReactNode } from 'react';
import { Button, DrawerBody, DrawerContent, DrawerFooter, DrawerTitle } from '@/components/system';

/** Shared drawer chrome for every profile section's edit form: title, a field stack, and a
 * Cancel/Save footer. Every section on this page pairs a read-only `Section` with a Drawer shaped
 * exactly like this, so the chrome lives here once instead of seven times. */
export function DrawerContentShell({
  title,
  onCancel,
  onSave,
  saving,
  saveLabel = 'Save',
  saveDisabled = false,
  children,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <DrawerContent>
      <DrawerTitle>{title}</DrawerTitle>
      <DrawerBody>
        <div className="flex flex-col gap-4">{children}</div>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={saving} disabled={saveDisabled} onClick={onSave}>
          {saveLabel}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}
