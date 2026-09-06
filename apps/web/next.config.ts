import { applyDotEnv } from '@apogee/shared/config';
import type { NextConfig } from 'next';

// The repo root .env is the single local config file; Next.js only reads apps/web/.env* itself.
applyDotEnv(process.cwd());

const nextConfig: NextConfig = {
  transpilePackages: ['@apogee/shared'],
  // The floating dev badge would otherwise appear in every screenshot taken against `next dev`.
  devIndicators: false,
  // `next build` while `next dev` is running clobbers the shared .next directory, so a build can be
  // pointed at its own output (NEXT_DIST_DIR=.next-build pnpm build) without stopping the dev server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    // Linting is run separately via `pnpm -F @apogee/web lint`.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default nextConfig;
