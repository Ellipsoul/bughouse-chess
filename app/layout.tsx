import type { Metadata, Viewport } from "next";
import { Fira_Code, Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "./components/layout/AppShell";

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
  title: "Relay - Bughouse Analysis",
  description: "A minimalistic elegant tool for analyzing and replaying Bughouse Chess matches",
  applicationName: "Relay",
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
      className={`h-full ${inter.variable} ${playfair.variable} ${firaCode.variable}`}
    >
      {/* Hard clamp the app to the viewport: the document should never scroll.
          Scrollable regions (like the move list) handle their own overflow. */}
      <body className="h-dvh overflow-hidden antialiased">
        <Providers>
          {/* Allow certain pages (e.g. viewer) to visually extend their top navbar
              into the sidebar column without being clipped horizontally. */}
          <main className="w-full h-full overflow-y-hidden overflow-x-visible">
            <AppShell>{children}</AppShell>
          </main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
