import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "Higgsfield clone",
  description: "An AI-native creative suite, rebuilt.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  // Lets the docked composer and bottom sheets pad themselves clear of the iPhone home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${publicSans.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
