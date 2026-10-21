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
  // Rewrite (not redirect) so /drone-sim and /flight-school keep clean
  // URLs in the browser while actually serving their public/*.html static
  // assets — which Next already serves at their own paths with no config
  // needed; this just gives each a second, extension-free entry point.
  // flight-school.html (Spectre-AI GCS) is a deliberately separate product
  // from drone-sim.html (Charleston venue explorer) — a beginner flight
  // trainer with failsafes/MAVLink, not the same experience.
  async rewrites() {
    return [
      {
        source: '/drone-sim',
        destination: '/drone-sim.html',
      },
      {
        source: '/flight-school',
        destination: '/spectre-gcs.html',
      },
    ];
  },
};

export default nextConfig;