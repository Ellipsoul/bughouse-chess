import type { Metadata, Viewport } from "next";
import { Fira_Code, Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bughouse Chess Viewer",
  description: "A modern implementation of Bughouse Chess",
  applicationName: "Bughouse Chess Viewer",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

/**
 * Root layout sets global fonts, background, and wraps pages with shared providers.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${firaCode.variable}`}
    >
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Providers>
          <main className="mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
