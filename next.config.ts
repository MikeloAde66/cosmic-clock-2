import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/products',
        destination: '/drone-sim.html',
        permanent: false,
      },
      {
        source: '/product',
        destination: '/drone-sim.html',
        permanent: false,
      },
    ];
  },
  // Rewrite (not redirect) so /drone-sim keeps a clean URL in the browser
  // while actually serving public/drone-sim.html — which Next already
  // serves as a static asset at its own path with no config needed; this
  // just gives it a second, extension-free entry point.
  async rewrites() {
    return [
      {
        source: '/drone-sim',
        destination: '/drone-sim.html',
      },
    ];
  },
};

export default nextConfig;