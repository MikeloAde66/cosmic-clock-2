import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only overlay (the "N" build-status badge) - never renders in a
  // production build regardless, but in local dev it was sitting directly
  // on top of the bottom-left radio player bar's "Live Stream" text.
  devIndicators: false,
};

export default nextConfig;
