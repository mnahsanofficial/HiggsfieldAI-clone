import type { Metadata } from "next";
import { LogPage } from "@/components/docket/log/log-page";
import { PublicLogPage } from "@/components/docket/log/public-log-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { listCreditEvents, listMyLog, listPublicLog, listPublicLogPage } from "@/lib/log/entries";

export async function generateMetadata({ searchParams }: PageProps<"/log">): Promise<Metadata> {
  const { scope } = await searchParams;
  return scope === "public"
    ? { title: "The public log", description: "Runs their makers chose to publish on Docket, and the library: what was asked for, the model that ran, and what it cost." }
    : { title: "Your log" };
}

// /log is your log; /log?scope=public is everyone's published runs and the library.
// Signed out (or signed in with nothing made yet), your log is an invitation: one line, a way to
// start, and the public log beneath so the page is never empty.
export default async function Log({ searchParams }: PageProps<"/log">) {
  const user = await getCurrentUser();
  const { view, scope } = await searchParams;
  if (scope === "public") {
    const page = await listPublicLogPage(user?.id ?? null, { limit: 12 });
    return <PublicLogPage initial={page.entries} more={page.more} initialView={view === "list" ? "list" : "media"} />;
  }
  const entries = user ? await listMyLog(user.id, { limit: 20 }) : [];
  const more = entries.length === 20;
  const [credits, publicEntries] = await Promise.all([
    user ? listCreditEvents(user.id, { after: more ? entries[entries.length - 1].createdAt : undefined }) : Promise.resolve([]),
    entries.length ? Promise.resolve([]) : listPublicLog(user?.id ?? null, { limit: 6 }),
  ]);
  return (
    <LogPage
      initial={entries}
      credits={credits}
      more={more}
      balanceTenths={user?.creditBalanceTenths ?? STARTER_CREDITS_TENTHS}
      signedIn={!!user}
      registered={user?.kind === "registered"}
      initialView={view === "list" ? "list" : "media"}
      publicEntries={publicEntries}
    />
  );
}
