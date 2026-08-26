import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Next.js badge off the bottom tab bar and FAB.
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
