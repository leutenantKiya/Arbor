import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Posters are self-hosted in /public/posters. When media moves to
    // Cloudflare R2 (ARCHITECTURE.md §6), add the R2 hostname here.
    remotePatterns: [],
  },
};

export default nextConfig;
