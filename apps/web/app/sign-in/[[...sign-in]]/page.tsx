import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AUTH_MODE } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  if (AUTH_MODE !== 'clerk') redirect('/dev/login');
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <SignIn />
    </main>
  );
}
