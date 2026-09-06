'use client';

import { useState } from 'react';
import { Button, Field, Input, TextLink } from '@/components/system';

const DEMO_STUDENT_EMAIL = 'demo@example.com';
const ADMIN_EMAIL = 'admin@example.com';

function randomStudentEmail(): string {
  return `student${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

export function DevLoginForm({ redirectUrl, error }: { redirectUrl: string; error?: string }) {
  const [email, setEmail] = useState('');

  return (
    <form action="/dev/session" method="POST" className="flex flex-col gap-6">
      <input type="hidden" name="redirect_url" value={redirectUrl} />
      <Field label="Email" error={error ? 'Enter a valid email address.' : undefined}>
        <Input id="dev-login-email" name="email" type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={!email}>
        Continue
      </Button>
      <div className="flex flex-col gap-2">
        <p className="text-12 text-fg-3">Development sign-in. Pick a demo account:</p>
        <div className="flex flex-wrap gap-4">
          <TextLink href="#" onClick={(event) => { event.preventDefault(); setEmail(DEMO_STUDENT_EMAIL); }}>
            Demo student
          </TextLink>
          <TextLink href="#" onClick={(event) => { event.preventDefault(); setEmail(ADMIN_EMAIL); }}>
            Admin
          </TextLink>
          <TextLink href="#" onClick={(event) => { event.preventDefault(); setEmail(randomStudentEmail()); }}>
            New student
          </TextLink>
        </div>
      </div>
    </form>
  );
}
