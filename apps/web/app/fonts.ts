import localFont from 'next/font/local';

/**
 * Both families are self-hosted (OFL, files in ./fonts) so the app renders identically with no
 * network and no third-party request. See docs/DESIGN.md for the roles and DECISIONS.md #36/#38.
 */
export const hanken = localFont({
  src: [
    { path: './fonts/hanken-grotesk-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/hanken-grotesk-latin-wght-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-ui',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const bricolage = localFont({
  src: [{ path: './fonts/bricolage-grotesque-latin-wght-normal.woff2', weight: '200 800', style: 'normal' }],
  variable: '--font-count',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});
