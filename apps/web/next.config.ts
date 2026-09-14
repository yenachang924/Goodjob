import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@cockpit/shared', '@cockpit/backend'],
  poweredByHeader: false,
};

export default nextConfig;
