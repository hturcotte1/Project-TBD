'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const QUICK_PICKS = [
  { label: 'Demo Student', email: 'demo@example.com' },
  { label: 'Admin', email: 'admin@example.com' },
];

function randomStudentEmail(): string {
  return `student${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

export function DevLoginForm({ redirectUrl, error }: { redirectUrl: string; error?: string }) {
  const [email, setEmail] = useState('');

  return (
    <form action="/dev/session" method="POST" className="space-y-6">
      <input type="hidden" name="redirect_url" value={redirectUrl} />
      {error ? <p className="rounded-md border border-urgent-border bg-urgent-bg px-3 py-2 text-sm text-urgent">Enter a valid email address.</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="dev-login-email">Email</Label>
        <Input
          id="dev-login-email"
          name="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" className="w-full" disabled={!email}>
        Continue
      </Button>
      <div className="space-y-2">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick picks</p>
        <div className="grid gap-2">
          {QUICK_PICKS.map((pick) => (
            <Button key={pick.email} type="button" variant="outline" className="justify-between" onClick={() => setEmail(pick.email)}>
              {pick.label}
              <span className="text-muted-foreground">{pick.email}</span>
            </Button>
          ))}
          <Button type="button" variant="outline" className="justify-between" onClick={() => setEmail(randomStudentEmail())}>
            New student
            <span className="text-muted-foreground">random email</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
