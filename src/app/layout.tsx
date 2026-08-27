import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";
const asset = (path: string) => `${basePath}${path}`;

export const metadata: Metadata = {
  title: "Ledger — Personal finance tracker",
  description:
    "Track accounts, transactions, and budgets. Sync to Supabase and link banks with Plaid.",
  applicationName: "Ledger",
  // Stable filenames (no query hash) so iOS “Add to Home Screen” picks these up.
  // Next.js does not prefix metadata.icons with `basePath` for static export.
  icons: {
    icon: [
      { url: asset("/favicon.ico"), sizes: "any" },
      { url: asset("/icon.png"), type: "image/png", sizes: "512x512" },
    ],
    apple: [
      {
        url: asset("/apple-touch-icon.png"),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Ledger",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0f14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
