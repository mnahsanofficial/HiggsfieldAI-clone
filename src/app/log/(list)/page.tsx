import { LogPage } from "@/components/docket/log/log-page";
import { getCurrentUser } from "@/lib/auth/current-user";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { listCreditEvents, listMyLog, listPublicLog } from "@/lib/log/entries";

export const metadata = { title: "Your log" };

// Signed out (or signed in with nothing made yet), the log is an invitation: one line, a way to
// start, and the public log beneath so the page is never empty.
export default async function Log({ searchParams }: PageProps<"/log">) {
  const user = await getCurrentUser();
  const { view } = await searchParams;
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
