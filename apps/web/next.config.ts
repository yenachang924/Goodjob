import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cockpit/shared', '@cockpit/backend'],
  poweredByHeader: false,
};

export default nextConfig;
