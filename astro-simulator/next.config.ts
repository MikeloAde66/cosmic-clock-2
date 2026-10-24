import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // This app lives in a monorepo with its own lockfile; pin the root so
  // Turbopack does not guess the repository root instead.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
