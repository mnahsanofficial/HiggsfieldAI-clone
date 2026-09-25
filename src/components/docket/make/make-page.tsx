"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { MeterState } from "@/components/ui/cost-meter";
import { priceJob } from "@/lib/credits/pricing";
import type { MakeData, MakeStill } from "@/lib/docket/make-data";
import type { LogAsset } from "@/lib/log/entries";
import { Entry } from "../log/entry";
import { useLog } from "../log/use-log";
import { Composer, type Mode } from "./composer";
import { MovePicker } from "./move-picker";
import { StillPicker } from "./still-picker";

const nearestAspect = (w: number, h: number, allowed: string[]) =>
  allowed.reduce((best, a) => {
    const [x, y] = a.split(":").map(Number);
    const [bx, by] = best.split(":").map(Number);
    return Math.abs(Math.log(w / h / (x / y))) < Math.abs(Math.log(w / h / (bx / by))) ? a : best;
  }, allowed[0]);

const PRERENDER_REASON = {
  kill_switch: "Live rendering is paused on this free-tier deployment to stay within its compute limit, so you'll get a pre-rendered example of this move, free.",
  expensive_preset: "This move takes about twice the compute of the others, so on this free-tier deployment it comes as a pre-rendered example, free.",
  render_cap: "You've used your live renders on this free-tier deployment, so you'll get a pre-rendered example of this move, free.",
};

export function MakePage({ data, initialMode, initialStillId, initialMoveId, initialPrompt }: { data: MakeData; initialMode: Mode; initialStillId: string | null; initialMoveId: string | null; initialPrompt: string }) {
  const router = useRouter();
  const log = useLog(data.entries, data.balanceTenths, { quota: data.quota });
  const { entries, balanceTenths, refresh } = log;
  const quota = log.quota ?? data.quota;
  // Images you can make right now: the lower of what's left for everyone and what's left for you.
  const allowance = Math.min(quota.siteLeft, quota.yoursLeft);
  const [signedIn, setSignedIn] = useState(data.signedIn);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState(data.image.aspects[0]);
  const [batch, setBatch] = useState(1);
  const [extraStills, setExtraStills] = useState<MakeStill[]>([]);
  const [stillId, setStillId] = useState<string | null>(initialStillId);
  const [moveId, setMoveId] = useState(initialMoveId && data.moves.some((m) => m.id === initialMoveId) ? initialMoveId : data.moves[0].id);
  const [sheet, setSheet] = useState<"still" | "move" | null>(null);
  const [liveLeft, setLiveLeft] = useState(data.policy.liveRendersLeft);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meter, setMeter] = useState<MeterState>("idle");
  const [frozenBalance, setFrozenBalance] = useState<number | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Stills: images made this session (from the log), then the ones the server knew about.
  const stills = useMemo(() => {
    const fromLog: MakeStill[] = entries
      .filter((e) => e.vertical === "image" && e.status === "succeeded")
      .flatMap((e) => e.assets.map((a) => ({ id: a.id, url: a.url, width: a.width, height: a.height, prompt: a.prompt, mine: true })));
    const seen = new Set<string>();
    return [...extraStills, ...fromLog, ...data.stills].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
  }, [entries, extraStills, data.stills]);

  const still = stills.find((s) => s.id === stillId) ?? null;
  const move = data.moves.find((m) => m.id === moveId) ?? data.moves[0];
  const moveAspect = still ? nearestAspect(still.width, still.height, data.video.aspects) : data.video.aspects[0];
  const prerenderReason =
    data.policy.mode === "prerendered" ? PRERENDER_REASON.kill_switch : data.policy.prerenderOnlyMotions.includes(move.motionType) ? PRERENDER_REASON.expensive_preset : liveLeft <= 0 ? PRERENDER_REASON.render_cap : null;
  const willPrerender = prerenderReason !== null;

  // The batch actually on offer: never more than today's allowance.
  const effectiveBatch = Math.max(1, Math.min(batch, allowance || 1));
  const costTenths =
    mode === "image"
      ? priceJob(data.image.pricing, { resolution: data.image.resolutions[0], batchSize: effectiveBatch }).costTenths
      : willPrerender
        ? 0
        : priceJob(data.video.pricing, { resolution: data.video.resolutions[0], batchSize: 1, durationS: data.video.durations[0] }).costTenths;

  async function ensureSession(): Promise<boolean> {
    if (signedIn) return true;
    const g = await fetch("/api/auth/guest", { method: "POST" });
    if (!g.ok) {
      const body = await g.json().catch(() => ({}));
      setError(body.message ?? body.error ?? "Couldn't start a session. Try again in a minute.");
      return false;
    }
    setSignedIn(true);
    return true;
  }

  // The commit: the meter drains while the new entry prints into the top of the log. The
  // meter keeps showing the old balance until the drain finishes, then settles on the new one.
  async function commit(body: Record<string, unknown>, before: number) {
    const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (res.status === 201) {
      setFrozenBalance(before);
      setMeter("committing");
      setNewId(out.job.id);
      await refresh();
      router.refresh();
      setTimeout(() => {
        setMeter("idle");
        setFrozenBalance(null);
      }, 750);
      return true;
    }
    if (res.status === 402) setError(`This costs more than your balance: ${out.requiredTenths / 10} credits needed, ${out.balanceTenths / 10} available. Nothing was charged.`);
    else setError(out.message ?? "That didn't go through. Nothing was charged. Try again.");
    return false;
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      if (!(await ensureSession())) return;
      if (mode === "image") {
        const ok = await commit({ vertical: "image", modelId: data.image.id, prompt: prompt.trim(), aspect, resolution: data.image.resolutions[0], batchSize: effectiveBatch }, balanceTenths);
        if (!ok) await refresh(); // a refused submit may mean the numbers moved: show the real ones
      } else if (still) {
        const ok = await commit(
          { vertical: "video", modelId: data.video.id, presetId: move.id, inputAssetId: still.id, aspect: moveAspect, resolution: data.video.resolutions[0], durationS: data.video.durations[0] },
          balanceTenths,
        );
        if (ok && !willPrerender) setLiveLeft((n) => Math.max(0, n - 1));
      }
    } finally {
      setPending(false);
    }
  }

  function moveCameraOver(asset: LogAsset | MakeStill) {
    setExtraStills((prev) => (prev.some((s) => s.id === asset.id) ? prev : [{ id: asset.id, url: asset.url, width: asset.width, height: asset.height, prompt: asset.prompt, mine: "mine" in asset ? asset.mine : true }, ...prev]));
    setStillId(asset.id);
    setMode("move");
    setError(null);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function act(id: string, action: "cancel" | "retry") {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
    if (action === "retry" && res.status === 201) setNewId((await res.json()).job?.id ?? null);
    else if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      setError(out.message ?? (action === "cancel" ? "That run couldn't be stopped. It may have just finished." : "That run couldn't be started again. Nothing was charged."));
    }
    await refresh();
    router.refresh();
    setBusyId(null);
  }

  return (
    <main className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-6 sm:py-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12">
      <div ref={composerRef} className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
        <Composer
          mode={mode}
          onMode={(m) => {
            setMode(m);
            setError(null);
          }}
          image={data.image}
          video={data.video}
          prompt={prompt}
          onPrompt={setPrompt}
          aspect={aspect}
          onAspect={setAspect}
          batch={effectiveBatch}
          onBatch={setBatch}
          quota={quota}
          still={still}
          move={move}
          moveAspect={moveAspect}
          onChooseStill={() => setSheet("still")}
          onChooseMove={() => setSheet("move")}
          costTenths={costTenths}
          balanceTenths={frozenBalance ?? balanceTenths}
          meter={meter}
          willPrerender={willPrerender}
          liveLeft={liveLeft}
          prerenderReason={prerenderReason}
          pending={pending}
          error={error}
          onSubmit={submit}
        />
      </div>

      <section aria-labelledby="log-heading" className="flex min-w-0 flex-col gap-6">
        <h2 id="log-heading" className="t-title">
          Your log
        </h2>
        {entries.length === 0 ? (
          <div className="flex flex-col gap-8">
            <p className="t-body max-w-xl text-muted">
              Everything you make lands here, newest first: what you asked for, the model that ran, what it cost, and any refund. Your log is private unless you choose to publish a run.
            </p>
            {data.publicEntries.length > 0 && (
              <div className="flex flex-col gap-6">
                <h3 className="t-label">From the public log</h3>
                <p className="t-meta -mt-4">Images from the library. Try moving the camera over one.</p>
                {data.publicEntries.map((e) => (
                  <Entry key={e.id} entry={e} onMoveCamera={moveCameraOver} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <ol className="flex flex-col gap-10">
            {entries.map((e) => (
              <li key={e.id}>
                <Entry
                  entry={e}
                  isNew={e.id === newId}
                  busy={busyId === e.id}
                  onMoveCamera={moveCameraOver}
                  onCancel={() => act(e.id, "cancel")}
                  // Only offer a retry that today's allowance can actually run.
                  onRetry={e.vertical === "image" && Number(e.params?.batchSize ?? 1) > allowance ? undefined : () => act(e.id, "retry")}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <StillPicker open={sheet === "still"} onClose={() => setSheet(null)} stills={stills} selectedId={stillId} onSelect={(s) => setStillId(s.id)} />
      <MovePicker open={sheet === "move"} onClose={() => setSheet(null)} moves={data.moves} selectedId={move.id} prerenderOnly={data.policy.prerenderOnlyMotions} onSelect={(m) => setMoveId(m.id)} />
    </main>
  );
}
