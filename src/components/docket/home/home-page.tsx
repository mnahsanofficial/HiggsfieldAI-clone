"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Compare } from "@/components/ui/compare";
import { CostMeter } from "@/components/ui/cost-meter";
import { Field, TextArea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { formatCredits } from "@/lib/credits/format";
import type { HomePair } from "@/lib/docket/home-pair";
import type { ImageQuota } from "@/lib/jobs/image-quota";
import type { LogEntry } from "@/lib/log/entries";
import { Entry } from "../log/entry";
import { RunRow } from "../log/list-row";
import { ImageAllowance } from "../make/composer";
import { ROUTES } from "../routes";

// Home: one line about what Docket is, the make box, then the log: yours if you have one, and
// the public log beneath (media first, list on request). Every number on it comes from the API.
export function HomePage({
  signedIn,
  balanceTenths,
  imageCostTenths,
  quota,
  mine,
  publicEntries,
  moveCount,
  liveRenders,
  pair,
}: {
  signedIn: boolean;
  balanceTenths: number;
  imageCostTenths: number;
  quota: ImageQuota;
  mine: LogEntry[];
  publicEntries: LogEntry[];
  moveCount: number;
  liveRenders: number;
  pair: HomePair | null;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"media" | "list">("media");
  const allowance = Math.min(quota.siteLeft, quota.yoursLeft);
  const short = imageCostTenths > balanceTenths;

  async function make() {
    setError(null);
    setPending(true);
    try {
      if (!signedIn) {
        const g = await fetch("/api/auth/guest", { method: "POST" });
        if (!g.ok) throw new Error((await g.json().catch(() => ({}))).message ?? "Couldn't start a session. Try again in a minute.");
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: "image", modelId: "flux_1_schnell", prompt: prompt.trim(), aspect: "1:1", resolution: "1K", batchSize: 1 }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status !== 201) throw new Error(out.message ?? "That didn't go through. Nothing was charged. Try again.");
      // The run is on the record now; /make is where it lands and where the loop continues.
      router.push(ROUTES.make);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Nothing was charged.");
      setPending(false);
    }
  }

  const shown = mine.length ? mine : publicEntries;
  const starter = !signedIn && (
    <p className="t-meta" data-testid="starter">
      No account needed: you start with {formatCredits(balanceTenths)} free credits, up to {quota.perVisitor} images a day and {liveRenders} live camera {liveRenders === 1 ? "move" : "moves"}.
    </p>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 py-8 sm:py-12">
      <section aria-labelledby="home-heading" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h1 id="home-heading" className="t-display">
              Docket makes an image, then moves the camera over it.
            </h1>
            <p className="t-body max-w-2xl text-muted">
              Every run stays on the record: the model that ran, what it cost, and any refund. Images come from FLUX.1 [schnell] when you ask; the {moveCount} camera moves are rendered over them with ffmpeg, frame by frame.
            </p>
          </div>
          {pair && (
            <figure className="flex flex-col gap-2" data-testid="home-pair">
              <Compare
                still={{ url: pair.still.url, alt: pair.still.prompt ?? "The still" }}
                take={{ url: pair.take.url, posterUrl: pair.take.posterUrl, label: `${pair.presetName}, rendered over the still` }}
                width={pair.take.width}
                height={pair.take.height}
                stillLabel="Library still"
              />
              <figcaption className="t-meta">
                {pair.presetName}, rendered with ffmpeg over a library still: this move&apos;s preview, straight from the renderer. Drag the handle to compare.
              </figcaption>
            </figure>
          )}
        </div>

        {allowance === 0 ? (
          // Out of today's images: lead with what still works, and say why second.
          <section aria-label="Make something" className="flex flex-col gap-4 self-start rounded-2xl bg-field p-4 sm:p-5">
            <ButtonLink href={`${ROUTES.make}?mode=move`} size="lg">
              Move the camera over a library image
            </ButtonLink>
            <ImageAllowance quota={quota} />
            {starter}
          </section>
        ) : (
          <form
            className="flex flex-col gap-4 self-start rounded-2xl bg-field p-4 sm:p-5"
            aria-label="Make an image"
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim() && !short) void make();
            }}
          >
            <Field id="home-prompt" label="Describe the image">
              <TextArea id="home-prompt" rows={3} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A lighthouse on black rocks at dusk, storm clouds, long exposure" />
            </Field>
            <ImageAllowance quota={quota} />
            <CostMeter costTenths={imageCostTenths} balanceTenths={balanceTenths} />
            {short ? (
              <ButtonLink href={ROUTES.credits} size="lg">
                Get more credits
              </ButtonLink>
            ) : (
              <Button type="submit" size="lg" pending={pending} disabled={!prompt.trim()}>
                Make the image
              </Button>
            )}
            {error && (
              <p role="alert" className="t-body text-charged">
                {error}
              </p>
            )}
            {starter}
          </form>
        )}
      </section>

      <section aria-labelledby="log-heading" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="log-heading" className="t-title">
              {mine.length ? "Your latest runs" : "The public log"}
            </h2>
            <p className="t-meta mt-1">
              {mine.length ? "Private unless you publish them." : "Library images, and runs their makers chose to publish. Nothing is public unless someone publishes it."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Segmented
              name="home-view"
              label="View"
              hideLabel
              value={view}
              onChange={setView}
              options={[
                { value: "media", label: "Media" },
                { value: "list", label: "List" },
              ]}
            />
            {mine.length > 0 && (
              <Link href={ROUTES.log} className="t-meta inline-block py-2 underline underline-offset-2 hover:text-ink">
                Open your log
              </Link>
            )}
          </div>
        </div>

        {view === "media" ? (
          <ol className="grid gap-x-8 gap-y-12 md:grid-cols-2">
            {shown.map((e) => (
              <li key={e.id}>
                <Entry entry={e} onMoveCamera={(a) => router.push(`${ROUTES.make}?still=${a.id}`)} />
              </li>
            ))}
          </ol>
        ) : (
          <ol className="flex max-w-[760px] flex-col gap-2">
            {shown.map((e) => (
              <RunRow key={e.id} entry={e} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
