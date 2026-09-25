import type { Metadata, Viewport } from "next";
import { DocketHeader } from "@/components/docket/header";

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const metadata: Metadata = {
  // Absolute URLs for share previews of published runs.
  metadataBase: new URL(host ? `https://${host}` : "http://localhost:3000"),
  title: { default: "Docket", template: "%s · Docket" },
  description: "Make an image, then direct a camera move over it. Every run on the record: the model that ran, what it cost, and any refund.",
};

export const viewport: Viewport = { themeColor: "#fcfcfa" };

export default function DocketLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="docket flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <DocketHeader />
      <div id="main" className="flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
