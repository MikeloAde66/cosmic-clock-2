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
};

export default nextConfig;