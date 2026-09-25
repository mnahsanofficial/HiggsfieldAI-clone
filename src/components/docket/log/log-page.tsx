"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { formatCredits } from "@/lib/credits/format";
import type { CreditEvent, LogEntry } from "@/lib/log/entries";
import { ROUTES } from "../routes";
import { Entry } from "./entry";
import { CreditRow, RunRow } from "./list-row";
import { PublishControl } from "./publish-control";
import { useLog } from "./use-log";

type Filter = "all" | "image" | "video";
type View = "media" | "list";

// The log is the library and the ledger. Media view (the default) shows what you made;
// list view shows every credit movement with the balance after it.
export function LogPage({
  initial,
  credits: initialCredits,
  more,
  balanceTenths,
  signedIn,
  registered,
  initialView,
  publicEntries,
}: {
  initial: LogEntry[];
  credits: CreditEvent[];
  more: boolean;
  balanceTenths: number;
  signedIn: boolean;
  registered: boolean;
  initialView: View;
  publicEntries: LogEntry[];
}) {
  const router = useRouter();
  const log = useLog(initial, balanceTenths, { credits: initialCredits, more });
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setViewState] = useState<View>(initialView);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    if (v === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  const shown = log.entries.filter((e) => filter === "all" || e.vertical === filter);
  const rows = useMemo(() => {
    const runs = shown.map((e) => ({ at: e.createdAt, run: e }) as const);
    const credits = filter === "all" ? log.credits.map((c) => ({ at: c.createdAt, credit: c }) as const) : [];
    return [...runs, ...credits].sort((a, b) => b.at.localeCompare(a.at));
  }, [shown, log.credits, filter]);

  async function act(id: string, action: "cancel" | "retry") {
    setBusyId(id);
    setActError(null);
    const res = await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      setActError(out.message ?? (action === "cancel" ? "That run couldn't be stopped. It may have just finished." : "That run couldn't be started again. Nothing was charged."));
    }
    await log.refresh();
    router.refresh();
    setBusyId(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display">Your log</h1>
          <p className="t-body mt-1 text-muted">
            {log.entries.length
              ? `Every run you've made, what it cost, and any refund. Balance: ${formatCredits(log.balanceTenths)} credits.`
              : signedIn
                ? "Nothing here yet."
                : `Your log starts with your first run. You'll have ${formatCredits(log.balanceTenths)} free credits, no account needed.`}
          </p>
        </div>
        <ButtonLink href={ROUTES.make}>Make something</ButtonLink>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          name="filter"
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Everything" },
            { value: "image", label: "Images" },
            { value: "video", label: "Camera moves" },
          ]}
        />
        <Segmented
          name="view"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "media", label: "Media" },
            { value: "list", label: "List" },
          ]}
        />
      </div>

      {actError && (
        <p role="alert" className="t-body max-w-[760px] rounded-xl bg-field p-4 text-charged">
          {actError}
        </p>
      )}

      {shown.length === 0 && !(view === "list" && rows.length > 0) && (
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl bg-field p-5">
          <p className="t-body">
            {filter === "video"
              ? "No camera moves yet. Make an image, then move the camera over it."
              : filter === "image"
                ? "No images yet. Describe one and it lands here, with what it cost."
                : "Everything you make lands here: what you asked for, the model that ran, what it cost, and any refund."}
          </p>
          <ButtonLink href={filter === "video" ? `${ROUTES.make}?mode=move` : ROUTES.make} variant="secondary" size="sm">
            {filter === "video" ? "Move the camera" : "Make an image"}
          </ButtonLink>
        </div>
      )}

      {shown.length === 0 && filter === "all" && publicEntries.length > 0 && (
        <section aria-labelledby="public-heading" className="flex max-w-[760px] flex-col gap-10 pt-2">
          <div>
            <h2 id="public-heading" className="t-title">
              From the public log
            </h2>
            <p className="t-meta mt-1">
              Images from the library. Try moving the camera over one, or{" "}
              <Link href={ROUTES.publicLog} className="inline-block py-2 underline underline-offset-2 hover:text-ink">
                see the whole public log
              </Link>
              .
            </p>
          </div>
          {publicEntries.map((e) => (
            <Entry key={e.id} entry={e} onMoveCamera={(a) => router.push(`${ROUTES.make}?still=${a.id}`)} />
          ))}
        </section>
      )}

      {shown.length > 0 && view === "media" && (
        <ol className="flex max-w-[760px] flex-col gap-12">
          {shown.map((e) => (
            <li key={e.id}>
              <Entry
                entry={e}
                busy={busyId === e.id}
                onCancel={() => act(e.id, "cancel")}
                onRetry={() => act(e.id, "retry")}
                onMoveCamera={(a) => router.push(`${ROUTES.make}?still=${a.id}`)}
                footer={e.status === "succeeded" && e.assets.length > 0 ? <PublishControl id={e.id} published={e.published} registered={registered} /> : null}
              />
            </li>
          ))}
        </ol>
      )}

      {rows.length > 0 && view === "list" && (
        <ol className="flex max-w-[760px] flex-col gap-2" aria-label="Credit movements, newest first">
          {rows.map((r) => ("run" in r ? <RunRow key={`r-${r.run.id}`} entry={r.run} /> : <CreditRow key={`c-${r.credit.id}`} event={r.credit} />))}
        </ol>
      )}

      {log.more && (
        <div className="max-w-[760px]">
          <Button variant="secondary" onClick={log.loadOlder} pending={log.loadingOlder}>
            Show older runs
          </Button>
        </div>
      )}
    </main>
  );
}
