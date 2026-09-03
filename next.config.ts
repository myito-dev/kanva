import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches the 12 MB limit from the original CanvasMetrics backend.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
