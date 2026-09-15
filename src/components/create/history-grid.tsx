"use client";

import { formatCredits } from "@/lib/credits/format";
import type { JobAsset, JobDTO } from "./types";

type Props = {
  jobs: JobDTO[];
  onOpen: (job: JobDTO, asset: JobAsset) => void;
  onCancel: (job: JobDTO) => void;
  onRetry: (job: JobDTO) => void;
  busyJobId: string | null;
};

const ratio = (aspect: string) => aspect.replace(":", " / ");

// History lives next to creation (recon §4). A masonry grid of the user's jobs, newest
// first: pending tiles with progress and Cancel, failures with the refund and Retry,
// labelled samples, and finished images that open in the lightbox.
export function HistoryGrid({ jobs, onOpen, onCancel, onRetry, busyJobId }: Props) {
  return (
    <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
      {jobs.map((job) => (
        <JobTiles key={job.id} job={job} onOpen={onOpen} onCancel={onCancel} onRetry={onRetry} busy={busyJobId === job.id} />
      ))}
    </div>
  );
}

function JobTiles({ job, onOpen, onCancel, onRetry, busy }: { job: JobDTO; busy: boolean } & Omit<Props, "jobs" | "busyJobId">) {
  if (job.status === "queued" || job.status === "processing") {
    return (
      <>
        {Array.from({ length: job.params.batchSize }, (_, i) => (
          <div
            key={i}
            className="relative mb-2 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
            style={{ aspectRatio: ratio(job.params.aspect) }}
          >
            <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_30%,rgba(212,255,63,0.08)_50%,transparent_70%)] bg-[length:200%_100%]" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
              <p className="line-clamp-2 text-xs text-white/60">{job.prompt}</p>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(job.progress, 8)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">{job.status === "queued" ? "Queued" : job.vertical === "video" ? "Rendering" : "Generating"} · {job.progress}%</span>
                {i === 0 && (
                  <button
                    type="button"
                    onClick={() => onCancel(job)}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (job.status === "failed" || job.status === "canceled") {
    const samples = job.assets.filter((a) => a.source === "sample");
    const isQuota = job.errorCode === "quota_exhausted" || job.errorCode === "rate_limited" || job.errorCode === "not_configured";
    return (
      <>
        <div className="mb-2 break-inside-avoid rounded-xl border border-white/10 bg-[#161618] p-3 text-sm">
          <p className="font-medium">{job.status === "canceled" ? "Canceled" : isQuota ? "Couldn't generate right now" : "Generation failed"}</p>
          <p className="mt-1 text-xs text-white/55">
            {job.status === "canceled" ? "You stopped this generation." : job.errorMessage}
          </p>
          {samples.length > 0 && (
            <p className="mt-2 text-xs text-amber-300/90">
              Showing {samples.length === 1 ? "a sample" : "samples"} from the library instead: not generated from your prompt.
            </p>
          )}
          <p className="mt-2 line-clamp-2 text-xs text-white/40">“{job.prompt}”</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-accent">+{formatCredits(job.costTenths)} refunded</span>
            <button
              type="button"
              onClick={() => onRetry(job)}
              disabled={busy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? "Retrying…" : `Retry · ${formatCredits(job.costTenths)}`}
            </button>
          </div>
        </div>
        {samples.map((a) => (
          <AssetTile key={a.id} asset={a} job={job} onOpen={onOpen} />
        ))}
      </>
    );
  }

  return (
    <>
      {job.assets.map((a) => (
        <AssetTile key={a.id} asset={a} job={job} onOpen={onOpen} />
      ))}
    </>
  );
}

function AssetTile({ asset, job, onOpen }: { asset: JobAsset; job: JobDTO; onOpen: Props["onOpen"] }) {
  const isVideo = asset.kind === "video";
  return (
    <button
      type="button"
      onClick={() => onOpen(job, asset)}
      className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl bg-white/5 text-left"
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      {isVideo ? (
        <video
          src={asset.url}
          poster={asset.posterUrl ?? undefined}
          muted
          loop
          playsInline
          preload="none"
          onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => e.currentTarget.pause()}
          className="h-full w-full object-cover"
          aria-label={asset.prompt ?? job.prompt}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- immutable /media route, sizes vary per asset
        <img src={asset.url} alt={asset.prompt ?? job.prompt} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
      )}
      {asset.source === "sample" ? (
        <span className="absolute left-2 top-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          {isVideo ? `▶ ${Math.round((asset.durationMs ?? 0) / 1000)}s · Pre-rendered example` : "Sample"}
        </span>
      ) : (
        isVideo && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
            ▶ {Math.round((asset.durationMs ?? 0) / 1000)}s · Rendered
          </span>
        )
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-xs text-white/85 opacity-0 transition group-hover:opacity-100">
        {asset.prompt ?? job.prompt}
      </span>
    </button>
  );
}
