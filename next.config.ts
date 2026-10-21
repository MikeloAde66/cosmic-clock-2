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
  // Rewrite (not redirect) so /drone-sim and /flight-school/simulator keep
  // clean URLs in the browser while actually serving their public/*.html
  // static assets — which Next already serves at their own paths with no
  // config needed; this just gives each a second, extension-free entry
  // point. /flight-school itself is a real page (app/flight-school/page.tsx)
  // now, not a rewrite — Next resolves filesystem routes before these,
  // so that page wins over this rule for the bare path.
  async rewrites() {
    return [
      {
        source: '/drone-sim',
        destination: '/drone-sim.html',
      },
      {
        source: '/flight-school/simulator',
        destination: '/spectre-gcs.html',
      },
    ];
  },
};

export default nextConfig;