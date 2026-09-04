'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Lock, MessageCircle, Save, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StepActions } from '@/components/onboarding/step-actions';
import type { OnboardingStepProps } from '@/components/onboarding/step-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { clientApi } from '@/lib/api.client';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

export function StepConnect({ onboarding, step }: OnboardingStepProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [acknowledged, setAcknowledged] = useState(onboarding.credentials.connected);

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => clientApi.call('settingsGet') });

  const syncStatusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => clientApi.call('syncStatus'),
    refetchInterval: (query) => {
      const s = query.state.data;
      if (!s) return 3000;
      if (s.awaiting_verification_job_id) return 2000;
      if (s.last_job && ACTIVE_JOB_STATUSES.has(s.last_job.status)) return 2000;
      return false;
    },
  });

  const connect = useMutation({
    mutationFn: () => clientApi.call('credentialsConnectCommonApp', { body: { email, password } }),
    onSuccess: () => {
      setPassword('');
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast({ title: 'Connecting…', description: 'Remy is logging in and checking your Common App account.' });
    },
    onError: () => toast({ title: 'Could not connect', description: 'Check the email and password and try again.', variant: 'destructive' }),
  });

  const disconnect = useMutation({
    mutationFn: () => clientApi.call('credentialsDisconnectCommonApp'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      toast({ title: 'Disconnected', description: 'Your Common App password has been deleted.' });
    },
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

  const save = useMutation({
    mutationFn: () => clientApi.call('onboardingStep', { body: { step: 6, data: { acknowledged } } }),
    onSuccess: (state) => router.push(`/onboarding/${state.step}`),
    onError: () => toast({ title: 'Could not save — try again.', variant: 'destructive' }),
  });

  const status = syncStatusQuery.data;
  const connected = status?.credentials.connected ?? onboarding.credentials.connected;
  const awaitingCode = Boolean(status?.awaiting_verification_job_id);
  const agentName = onboarding.agent_name;
  const agentPhone = onboarding.agent_phone_number;
  const gmailEnabled = settingsQuery.data?.features.gmail ?? false;

  const vcardHref = `/api/vcard?name=${encodeURIComponent(agentName)}&phone=${encodeURIComponent(agentPhone)}`;
  const smsHref = `sms:${agentPhone}`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Connect</h1>
        <p className="text-sm text-muted-foreground">Two ways Remy stays in the loop — Common App, and texting you directly.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Common App
          </CardTitle>
          <CardDescription>
            Your password is encrypted at rest and decrypted only for a few seconds inside Remy&rsquo;s browser worker — to read your account and fill in what
            you approve. It is never used to submit anything. Disconnect any time from Settings and it&rsquo;s deleted immediately.{' '}
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              Read the full privacy page
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected ? (
            <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
                Disconnect
              </Button>
            </div>
          ) : awaitingCode ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm">Common App just sent you a code — text it to {agentName} or enter it here.</p>
              <div className="flex gap-2">
                <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={12} />
                <Button type="button" onClick={() => submitCode.mutate()} loading={submitCode.isPending} disabled={!code}>
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ca-email">Common App email</Label>
                <Input id="ca-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-password">Common App password</Label>
                <Input id="ca-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <Button type="button" onClick={() => connect.mutate()} loading={connect.isPending} disabled={!email || !password}>
                Connect Common App
              </Button>
            </div>
          )}
          {status?.last_job && ACTIVE_JOB_STATUSES.has(status.last_job.status) && !awaitingCode ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying your login…
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" /> Text {agentName}
          </CardTitle>
          <CardDescription>Save the contact, or send the first text yourself — replies usually arrive within seconds.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <a href={smsHref}>Text me</a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={vcardHref}>
              <Save className="h-3.5 w-3.5" /> Save contact
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Gmail
          </CardTitle>
          <CardDescription>
            {gmailEnabled ? 'Read-only access so Remy can catch recommender and portal emails.' : 'Coming soon — read-only access so Remy can catch recommender and portal emails.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" disabled>
            {gmailEnabled ? 'Connect Gmail' : 'Coming soon'}
          </Button>
        </CardContent>
      </Card>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked === true)} className="mt-0.5" />
        <span>I understand how my Common App password is used and stored.</span>
      </label>

      <StepActions step={step} loading={save.isPending} disabled={!acknowledged} />
    </form>
  );
}
