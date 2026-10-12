import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only overlay (the "N" build-status badge) - never renders in a
  // production build regardless, but in local dev it was sitting directly
  // on top of the bottom-left radio player bar's "Live Stream" text.
  devIndicators: false,
  // Next.js 16 blocks HMR/dev-resource requests from origins not listed
  // here by default — without this, loading the dev server via 127.0.0.1
  // (rather than localhost) leaves the page hydration-broken: HTML renders
  // but no client interactivity ever attaches (confirmed directly — even
  // pre-existing buttons stopped responding to clicks under 127.0.0.1).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
