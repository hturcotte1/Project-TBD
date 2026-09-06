'use client';

import type { CredentialStatusDto, SyncStatusDto } from '@apogee/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
  ErrorNote,
  Field,
  Input,
  OkNote,
  Section,
  toast,
} from '@/components/system';
import { clientApi } from '@/lib/api.client';
import { relativeTimeFromNow } from '@/lib/format';

function connectedSentence(credential: CredentialStatusDto): string {
  const checkedAt = credential.last_used_at ?? credential.verified_at;
  const name = credential.username ?? 'Common App';
  return checkedAt ? `Connected as ${name}, checked ${relativeTimeFromNow(checkedAt)}.` : `Connected as ${name}.`;
}

export function CommonAppSection({ credential, syncStatus }: { credential: CredentialStatusDto | undefined; syncStatus: SyncStatusDto | undefined }) {
  const queryClient = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const connect = useMutation({
    mutationFn: () => clientApi.call('credentialsConnectCommonApp', { body: { email, password } }),
    onSuccess: () => {
      setEmail('');
      setPassword('');
      setConnectOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Connecting to Common App.');
    },
    onError: () => toast('Could not connect. Check the email and password and try again.'),
  });

  const disconnect = useMutation({
    mutationFn: () => clientApi.call('credentialsDisconnectCommonApp'),
    onSuccess: () => {
      setDisconnectOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Disconnected.');
    },
    onError: () => toast('Could not disconnect. Try again.'),
  });

  const submitCode = useMutation({
    mutationFn: () => clientApi.call('verificationCodeSubmit', { body: { code } }),
    onSuccess: () => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast('Code submitted.');
    },
    onError: () => toast('That code did not work. Try again, or wait for a fresh one.'),
  });

  const connected = credential?.connected === true && credential.status === 'active';
  const invalid = credential?.status === 'invalid';
  const canDisconnect = credential?.connected === true;
  const awaitingCode = Boolean(syncStatus?.awaiting_verification_job_id);

  return (
    <Section title="Common App">
      <div className="flex flex-col gap-3">
        {connected && credential ? <OkNote>{connectedSentence(credential)}</OkNote> : invalid ? <ErrorNote>Common App login stopped working. Reconnect.</ErrorNote> : <p className="text-14 text-fg-2">Not connected.</p>}

        <div className="flex flex-wrap items-center gap-4">
          {!connected ? (
            <Drawer open={connectOpen} onOpenChange={setConnectOpen}>
              <DrawerTrigger asChild>
                <Button variant="text" className="h-auto px-0">
                  {invalid ? 'Reconnect' : 'Connect'}
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerTitle>Connect Common App</DrawerTitle>
                <DrawerBody>
                  <div className="flex flex-col gap-4">
                    <Field label="Common App email">
                      <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                    </Field>
                    <Field label="Common App password">
                      <Input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                    </Field>
                    <p className="text-12 text-fg-2">Stored encrypted, used only to read and fill your application, never to submit.</p>
                  </div>
                </DrawerBody>
                <DrawerFooter>
                  <Button variant="quiet" onClick={() => setConnectOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={connect.isPending} disabled={!email || !password} onClick={() => connect.mutate()}>
                    Connect
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : null}

          {canDisconnect ? (
            <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
              <DialogTrigger asChild>
                <Button variant="danger" className="h-auto px-0">
                  Disconnect
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Disconnect Common App?</DialogTitle>
                <DialogDescription>Apogee deletes the saved password and stops syncing.</DialogDescription>
                <DialogActions>
                  <Button variant="quiet" onClick={() => setDisconnectOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
                    Disconnect
                  </Button>
                </DialogActions>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        {awaitingCode ? (
          <div className="flex max-w-md flex-col gap-2">
            <Field label="Verification code">
              <div className="flex gap-2">
                <Input className="font-mono" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={12} />
                <Button variant="text" loading={submitCode.isPending} disabled={!code} onClick={() => submitCode.mutate()}>
                  Send code
                </Button>
              </div>
            </Field>
            <p className="text-12 text-fg-2">Common App sent a code to your phone or email. Apogee uses it once and never stores it.</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
