import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IconProvider, Toaster, TooltipProvider } from '@/components/system';
import { AUTH_MODE } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';
import { bricolage, hanken } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Apogee', template: '%s, Apogee' },
  description: 'An autonomous college-application agent: every deadline counted down, every draft ready for your approval, nothing submitted without you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Applies the stored theme before first paint so a light-theme user never sees a dark flash.
 * Values: "dark" | "light"; anything else (or nothing) follows the system preference.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('apogee-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  const content = (
    <html lang="en" className={`${hanken.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <QueryProvider>
          <IconProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </IconProvider>
        </QueryProvider>
      </body>
    </html>
  );

  // ClerkProvider is only ever mounted in AUTH_MODE=clerk, so the app builds and runs in dev mode
  // with zero Clerk keys configured (it would throw if rendered without a publishable key).
  return AUTH_MODE === 'clerk' ? <ClerkProvider>{content}</ClerkProvider> : content;
}
