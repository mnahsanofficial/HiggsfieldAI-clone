"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import type { LogEntry } from "@/lib/log/entries";
import { ROUTES } from "../routes";
import { Entry } from "./entry";
import { RunRow } from "./list-row";

type View = "media" | "list";

// The public log, all of it: runs their makers chose to publish, newest first, then the seed
// library. Read-only; paged by offset so "Show more" never repeats an entry.
export function PublicLogPage({ initial, more: initialMore, initialView }: { initial: LogEntry[]; more: boolean; initialView: View }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(initialView);

  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    if (v === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  async function showMore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/log?scope=public&offset=${entries.length}&limit=12`);
      if (!res.ok) throw new Error();
      const page = (await res.json()) as { entries: LogEntry[]; more: boolean };
      setEntries((prev) => [...prev, ...page.entries.filter((e) => !prev.some((p) => p.id === e.id))]);
      setMore(page.more);
    } catch {
      setError("Couldn't load more of the public log. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display">The public log</h1>
          <p className="t-body mt-1 max-w-2xl text-muted">Runs their makers chose to publish, newest first, then images from the library. Nothing is public unless someone publishes it.</p>
        </div>
        <ButtonLink href={ROUTES.make}>Start making</ButtonLink>
      </div>

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

      {view === "media" ? (
        <ol className="flex max-w-[760px] flex-col gap-12">
          {entries.map((e) => (
            <li key={e.id}>
              <Entry entry={e} onMoveCamera={(a) => router.push(`${ROUTES.make}?still=${a.id}`)} />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="flex max-w-[760px] flex-col gap-2" aria-label="The public log, newest first">
          {entries.map((e) => (
            <RunRow key={e.id} entry={e} />
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="t-body max-w-[760px] text-charged">
          {error}
        </p>
      )}
      {more && (
        <div className="max-w-[760px]">
          <Button variant="secondary" onClick={showMore} pending={loading}>
            Show more
          </Button>
        </div>
      )}
    </main>
  );
}
