import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(!isDev ? { output: "export" as const } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  // The default on-screen badge covers the bottom tab bar on phones.
  devIndicators: false,
};

export default nextConfig;
