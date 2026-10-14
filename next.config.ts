import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep server actions body size modest; uploads are not supported yet.
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  eslint: {
    // Linting is run explicitly in CI (`npm run lint`); do not fail builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
