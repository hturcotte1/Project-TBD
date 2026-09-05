import { applyDotEnv } from '@apogee/shared/config';
import type { NextConfig } from 'next';

// The repo root .env is the single local config file; Next.js only reads apps/web/.env* itself.
applyDotEnv(process.cwd());

const nextConfig: NextConfig = {
  transpilePackages: ['@apogee/shared'],
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
