import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@movo/brasil'],
  webpack: (config) => {
    // Imports ESM-style com sufixo `.js` do backend resolvem para `.ts`.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      ...(config.resolve.extensionAlias ?? {}),
    };
    return config;
  },
};

export default nextConfig;
