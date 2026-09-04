'use client';

import type { CredentialStatusDto, SyncStatusDto } from '@tbd/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

export function CommonAppCard({ credential, syncStatus }: { credential: CredentialStatusDto; syncStatus: SyncStatusDto | undefined }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connect = useMutation({
    mutationFn: () => clientApi.call('credentialsConnectCommonApp', { body: { email, password } }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Connecting…', description: 'Remy is logging in and checking your Common App account.' });
    },
    onError: () => toast({ title: 'Could not connect', description: 'Check the email and password and try again.', variant: 'destructive' }),
  });

  const disconnect = useMutation({
    mutationFn: () => clientApi.call('credentialsDisconnectCommonApp'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Disconnected', description: 'Your Common App password has been deleted.' });
    },
    onError: () => toast({ title: 'Could not disconnect — try again.', variant: 'destructive' }),
    onSettled: () => setConfirmDisconnect(false),
  });

  const submitCode = useMutation({
    mutationFn: () => clientApi.call('verificationCodeSubmit', { body: { code } }),
    onSuccess: () => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast({ title: 'Code submitted', description: 'Finishing the connection now.' });
    },
    onError: () => toast({ title: 'That code did not work', description: 'Try again, or wait for a fresh one.', variant: 'destructive' }),
  });

  const connected = credential.connected && credential.status === 'active';
  const awaitingCode = Boolean(syncStatus?.awaiting_verification_job_id);
  const syncing = Boolean(syncStatus?.last_job && ACTIVE_JOB_STATUSES.has(syncStatus.last_job.status) && !awaitingCode);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" /> Common App
        </CardTitle>
        <CardDescription>
          Your password is encrypted at rest and decrypted only for a few seconds inside Remy&rsquo;s browser worker — to read your account and fill in what you
          approve. It is never used to submit anything. Disconnecting deletes it immediately.{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Read the full privacy page
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
                Disconnect &amp; delete credentials
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {credential.verified_at ? (
                <div>
                  <dt className="inline font-medium text-foreground/70">Verified: </dt>
                  <dd className="inline">{relativeTimeFromNow(credential.verified_at)}</dd>
                </div>
              ) : null}
              {credential.last_used_at ? (
                <div>
                  <dt className="inline font-medium text-foreground/70">Last used: </dt>
                  <dd className="inline">{relativeTimeFromNow(credential.last_used_at)}</dd>
                </div>
              ) : null}
              {credential.failure_count > 0 ? (
                <div>
                  <dt className="inline font-medium text-foreground/70">Failed attempts: </dt>
                  <dd className="inline">{credential.failure_count}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : awaitingCode ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm">Common App just sent you a code — text it to Remy or enter it here.</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={12} />
              <Button type="button" onClick={() => submitCode.mutate()} loading={submitCode.isPending} disabled={!code}>
                Submit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {credential.status === 'invalid' ? (
              <p className="flex items-center gap-2 rounded-md border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Your Common App login stopped working — reconnect below.
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="settings-ca-email">Common App email</Label>
              <Input id="settings-ca-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-ca-password">Common App password</Label>
              <Input id="settings-ca-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <Button type="button" onClick={() => connect.mutate()} loading={connect.isPending} disabled={!email || !password}>
              {credential.status === 'invalid' ? 'Reconnect Common App' : 'Connect Common App'}
            </Button>
          </div>
        )}
        {syncing ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
          </p>
        ) : null}
      </CardContent>

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Common App?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Your stored password is deleted immediately and any queued syncs are cancelled. You can reconnect any time.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
