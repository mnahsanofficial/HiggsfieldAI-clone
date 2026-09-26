import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DocketFooter } from "@/components/docket/footer";
import { DocketHeader } from "@/components/docket/header";
import "./globals.css";

// Self-hosted so a clean clone builds with no network (a Google Fonts import broke that once).
// Public Sans, variable 300-800: drawn for government forms, which is the right voice for a
// product whose interface is a record of what it charged you.
const publicSans = localFont({
  src: "./fonts/public-sans-latin.woff2",
  weight: "300 800",
  display: "swap",
  variable: "--font-public-sans",
});

// The project's production domain (docket-nahsan.vercel.app), set by Vercel at build time, so
// share previews and permalinks always point at the live site, whatever host a request came in on.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  // Absolute URLs for share previews of published runs.
  metadataBase: new URL(host ? `https://${host}` : "http://localhost:3000"),
  title: { default: "Docket", template: "%s · Docket" },
  description: "Make an image, then direct a camera move over it. Every run on the record: the model that ran, what it cost, and any refund.",
};

export const viewport: Viewport = {
  themeColor: "#fcfcfa",
  // Lets bottom sheets pad themselves clear of the iPhone home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${publicSans.variable}`}>
      <body className="docket flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <DocketHeader />
        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
        <DocketFooter />
      </body>
    </html>
  );
}
