import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev route indicator (the "N" badge) in development.
  devIndicators: false,
  reactStrictMode: false,
};

export default nextConfig;
