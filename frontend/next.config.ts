import type { NextConfig } from 'next';

/**
 * Static export configuration.
 *
 * The production container serves the exported frontend through Express
 * (backend/public), so the app must not depend on Next.js SSR, API routes or
 * server actions. Dynamic routing uses query parameters for this reason.
 */
const nextConfig: NextConfig = {
  output: 'export',
  // Clean URLs (no trailing slash) so /api proxy paths are never rewritten.
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  // Development proxy: the dev server forwards API calls to Express so the
  // browser only ever talks to one origin (matching production behaviour).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_PROXY ?? 'http://127.0.0.1:5000'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_PROXY ?? 'http://127.0.0.1:5000'}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
