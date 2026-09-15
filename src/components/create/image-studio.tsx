"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { formatCredits } from "@/lib/credits/format";
import { HistoryGrid } from "./history-grid";
import { type ComposerState, ImageComposer } from "./image-composer";
import { Lightbox } from "./lightbox";
import type { JobAsset, JobDTO, StudioModel } from "./types";
import { useJobs } from "./use-jobs";

type Props = {
  models: StudioModel[];
  initialModelId: string;
  initialPrompt?: string;
  initialJobs: JobDTO[];
  signedIn: boolean;
  showcase: { url: string; prompt: string | null }[];
};

type ApiError = { error?: string; message?: string; requiredTenths?: number; balanceTenths?: number };

export function ImageStudio({ models, initialModelId, initialPrompt = "", initialJobs, signedIn: initiallySignedIn, showcase }: Props) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(initiallySignedIn);
  const { jobs, upsert, refresh } = useJobs("image", initialJobs, signedIn);
  const [composer, setComposer] = useState<ComposerState>({ prompt: initialPrompt, modelId: initialModelId, aspect: "1:1", batchSize: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; outOfCredits?: boolean } | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ job: JobDTO; asset: JobAsset } | null>(null);

  const describe = (status: number, body: ApiError) =>
    body.error === "insufficient_credits"
      ? { message: `Not enough credits: this costs ${formatCredits(body.requiredTenths ?? 0)}, you have ${formatCredits(body.balanceTenths ?? 0)}.`, outOfCredits: true }
      : { message: body.message ?? (status === 429 ? "Too many requests. Try again shortly." : "Something went wrong. Nothing was charged.") };

  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    const post = () =>
      fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: composer.modelId, prompt: composer.prompt, aspect: composer.aspect, resolution: "1K", batchSize: composer.batchSize }),
      });
    try {
      let res = await post();
      if (res.status === 401) {
        // Signed out: start a guest session inline, then submit. One click, no detour.
        const guest = await fetch("/api/auth/guest", { method: "POST" });
        const g = (await guest.json()) as { ok: boolean; error?: string };
        if (!g.ok) {
          setError({ message: g.error ?? "Couldn't start a guest session." });
          return;
        }
        setSignedIn(true);
        res = await post();
      }
      const body = await res.json();
      if (res.status === 201) {
        upsert(body.job as JobDTO);
        router.refresh(); // header balance
      } else {
        setError(describe(res.status, body));
      }
    } catch {
      setError({ message: "Network error. Nothing was charged." });
    } finally {
      setSubmitting(false);
    }
  }, [composer, upsert, router]);

  const cancel = useCallback(
    async (job: JobDTO) => {
      setBusyJobId(job.id);
      await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      await refresh();
      router.refresh();
      setBusyJobId(null);
    },
    [refresh, router],
  );

  const retry = useCallback(
    async (job: JobDTO) => {
      setBusyJobId(job.id);
      setError(null);
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      const body = await res.json();
      if (res.status === 201) upsert(body.job as JobDTO);
      else setError(describe(res.status, body));
      router.refresh();
      setBusyJobId(null);
    },
    [upsert, router],
  );

  const model = models.find((m) => m.id === composer.modelId) ?? models[0];

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-64 pt-4 sm:px-4 sm:pb-48">
        {jobs.length === 0 ? (
          <EmptyState modelName={model.name} showcase={showcase} />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h1 className="text-sm font-semibold uppercase tracking-widest text-white/50">History</h1>
              <p className="text-xs text-white/35">{model.name} · real model output</p>
            </div>
            <HistoryGrid jobs={jobs} onOpen={(job, asset) => setOpen({ job, asset })} onCancel={cancel} onRetry={retry} busyJobId={busyJobId} />
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-3 pt-8 sm:px-4 sm:pb-5">
        <div className="mx-auto max-w-4xl">
          <ImageComposer
            models={models}
            state={composer}
            onChange={(next) => setComposer((s) => ({ ...s, ...next }))}
            onSubmit={submit}
            submitting={submitting}
            error={error}
          />
        </div>
      </div>

      {open && <Lightbox job={open.job} asset={open.asset} onClose={() => setOpen(null)} onReuse={(prompt) => setComposer((s) => ({ ...s, prompt }))} />}
    </main>
  );
}

function EmptyState({ modelName, showcase }: { modelName: string; showcase: { url: string; prompt: string | null }[] }) {
  const rotations = ["-rotate-12 translate-y-3", "-rotate-3", "rotate-3", "rotate-12 translate-y-3"];
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="mb-8 flex items-end justify-center">
        {showcase.slice(0, 4).map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- immutable /media route
          <img
            key={s.url}
            src={s.url}
            alt={s.prompt ?? "Example generation"}
            className={`-mx-3 h-28 w-20 rounded-xl border-2 border-white/15 object-cover shadow-xl sm:-mx-4 sm:h-40 sm:w-32 ${rotations[i]}`}
          />
        ))}
      </div>
      <h1 className="text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
        Start creating with
        <br />
        <span className="text-accent">{modelName}</span>
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/55">Describe a scene, character, mood, or style, and watch it come to life.</p>
      <p className="mt-2 text-xs text-white/35">Real model output · non-square ratios are a centre crop of 1024×1024</p>
    </div>
  );
}
