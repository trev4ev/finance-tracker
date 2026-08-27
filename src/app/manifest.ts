import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger",
    short_name: "Ledger",
    description:
      "Track accounts, transactions, and budgets. Sync to Supabase and link banks with Plaid.",
    start_url: basePath ? `${basePath}/` : "/",
    display: "standalone",
    background_color: "#1C1C1E",
    theme_color: "#0c0f14",
    icons: [
      {
        src: `${basePath}/icon.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/apple-icon.png`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
