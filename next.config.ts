import type { NextConfig } from "next";

const nextConfig: NextConfig = {
<<<<<<< HEAD
=======
  // Dev-only overlay (the "N" build-status badge) - never renders in a
  // production build regardless, but in local dev it was sitting directly
  // on top of the bottom-left radio player bar's "Live Stream" text.
>>>>>>> d95a5d692cdc163f13ffcc0d1125387393eb1254
  devIndicators: false,
  allowedDevOrigins: ['192.168.12.181:3000', '127.0.0.1', 'localhost'],
};
export default nextConfig;
