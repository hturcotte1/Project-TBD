import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DevLoginForm } from '@/components/auth/dev-login-form';
import { AUTH_MODE } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dev sign-in' };

export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string; error?: string }> }) {
  if (AUTH_MODE !== 'dev') redirect('/sign-in');
  const { redirect_url, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-12 lg:px-8">
      {/* Warms the Bricolage font file, unused elsewhere on this page — see the same pattern on
          Activity, Schools and Essays. */}
      <VisuallyHidden>
        <span className="font-count">0</span>
      </VisuallyHidden>
      <div className="flex flex-col gap-2">
        <p className="text-28 font-semibold">Apogee</p>
        <p className="text-14 text-fg-2">An autonomous college-application agent. It reads, drafts and reminds; you approve and submit.</p>
      </div>
      <DevLoginForm redirectUrl={redirect_url && redirect_url.startsWith('/') ? redirect_url : '/'} error={error} />
    </main>
  );
}
