'use client';

import { useClerk } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type { AuthMode } from '@/lib/auth';
import { clientApi } from '@/lib/api.client';

const CONFIRM_WORD = 'DELETE';

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

function RedirectingNotice() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Signing you out…
    </p>
  );
}

export function DangerZone({ authMode }: { authMode: AuthMode }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleted, setDeleted] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: () => clientApi.call('accountDelete', { body: { confirm: CONFIRM_WORD } }),
    onSuccess: () => setDeleted(true),
    onError: () => toast({ title: 'Could not delete your account — try again.', variant: 'destructive' }),
  });

  if (deleted) {
    return authMode === 'clerk' ? <ClerkSignOutRedirect /> : <DevLogoutRedirect />;
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>Deletes everything — uploads, messages, essays, and your Common App credentials — in one job. This cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes your profile, activities, essays, messages, and Common App credentials. You&rsquo;ll get a confirmation text. Type{' '}
            <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span> to confirm.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">Type {CONFIRM_WORD}</Label>
            <Input id="delete-confirm" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={confirmText !== CONFIRM_WORD} loading={deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
