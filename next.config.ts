import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['192.168.12.181:3000', '127.0.0.1', 'localhost'],
};
export default nextConfig;
