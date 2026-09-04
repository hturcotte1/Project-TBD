import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DevLoginForm } from '@/components/auth/dev-login-form';
import { AUTH_MODE } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dev sign-in' };

export default async function DevLoginPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string; error?: string }> }) {
  if (AUTH_MODE !== 'dev') redirect('/sign-in');
  const { redirect_url, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Dev mode — no password needed locally. Pick who you are.</p>
      </div>
      <DevLoginForm redirectUrl={redirect_url && redirect_url.startsWith('/') ? redirect_url : '/'} error={error} />
    </main>
  );
}
