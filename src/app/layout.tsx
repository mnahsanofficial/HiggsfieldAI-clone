import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
