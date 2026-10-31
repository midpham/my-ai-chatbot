import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Bắt buộc phải có dòng này cho Cloudflare Pages
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
