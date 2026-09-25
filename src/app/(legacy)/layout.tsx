import { AppHeader } from "@/components/app-header";

// The original UI, kept running unchanged while Docket is built alongside it. Everything in
// this group is removed at switch-over.
export default function LegacyLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="legacy flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      {children}
    </div>
  );
}
