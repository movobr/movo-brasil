import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@movo/brasil'],
  async headers() {
    // 33: secure headers em todas as respostas.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
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
