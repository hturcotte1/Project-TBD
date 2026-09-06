import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AUTH_MODE } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

// Clerk paints its own chrome; the appearance variables below are the only place it borrows the
// app's tokens (see docs/DESIGN.md) rather than defaulting to Clerk's own palette.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: 'var(--brand)',
    colorBackground: 'var(--s1)',
    colorText: 'var(--fg)',
    colorInputBackground: 'var(--s2)',
    colorInputText: 'var(--fg)',
    borderRadius: 'var(--radius-control)',
    fontFamily: 'var(--font-ui)',
  },
};

export default function SignInPage() {
  if (AUTH_MODE !== 'clerk') redirect('/dev/login');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-12 lg:px-8">
      {/* Warms the Bricolage font file, unused elsewhere on this page. */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <div className="flex flex-col gap-2">
        <p className="text-28 font-semibold">Apogee</p>
        <p className="text-14 text-fg-2">An autonomous college-application agent. It reads, drafts and reminds; you approve and submit.</p>
      </div>
      <SignIn appearance={CLERK_APPEARANCE} />
    </main>
  );
}
