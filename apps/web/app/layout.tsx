import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { AUTH_MODE } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'TBD', template: '%s · TBD' },
  description: 'Your college application, handled — a next action every day, drafted for your approval, never submitted without it.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const content = (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );

  // ClerkProvider is only ever mounted in AUTH_MODE=clerk, so the app builds and runs in dev mode
  // with zero Clerk keys configured (it would throw if rendered without a publishable key).
  return AUTH_MODE === 'clerk' ? <ClerkProvider>{content}</ClerkProvider> : content;
}
