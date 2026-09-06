'use client';

import { useClerk } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Field, Input, Section, toast } from '@/components/system';
import type { AuthMode } from '@/lib/auth';
import { clientApi } from '@/lib/api.client';

const CONFIRM_WORD = 'DELETE';

function RedirectingNotice() {
  return <p className="text-14 text-fg-2">Signing you out.</p>;
}

/** Only ever mounted when `authMode === 'clerk'`, at which point the root layout has already
 * wrapped the app in `ClerkProvider` — so `useClerk()` is always safe here. */
function ClerkSignOutRedirect() {
  const { signOut } = useClerk();
  useEffect(() => {
    void signOut({ redirectUrl: '/sign-in' });
  }, [signOut]);
  return <RedirectingNotice />;
}

function DevLogoutRedirect() {
  useEffect(() => {
    window.location.href = '/dev/logout';
  }, []);
  return <RedirectingNotice />;
}

export function DeleteAccountSection({ authMode }: { authMode: AuthMode }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleted, setDeleted] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: () => clientApi.call('accountDelete', { body: { confirm: CONFIRM_WORD } }),
    onSuccess: () => setDeleted(true),
    onError: () => toast('Could not delete your account. Try again.'),
  });

  if (deleted) {
    return authMode === 'clerk' ? <ClerkSignOutRedirect /> : <DevLogoutRedirect />;
  }

  return (
    <Section title="Delete account">
      <p className="text-14 text-fg">Deletes every application, essay, message and credential. There is no undo.</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText('');
        }}
      >
        <DialogTrigger asChild>
          <Button variant="danger" className="h-auto px-0">
            Delete my account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, activities, essays, messages and Common App credentials. Type {CONFIRM_WORD} to confirm.
          </DialogDescription>
          <Field label={`Type ${CONFIRM_WORD}`}>
            <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" />
          </Field>
          <DialogActions>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={confirmText !== CONFIRM_WORD} loading={deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
              Delete everything
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
