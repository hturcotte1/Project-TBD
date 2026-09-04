import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tbd/shared'],
  eslint: {
    // Linting is run separately via `pnpm -F @tbd/web lint`.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default nextConfig;
