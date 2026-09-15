"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobAsset, JobDTO } from "./types";
import { SkeletonImg, SkeletonVideo } from "@/components/media/skeleton-media";

type Props = {
  job: Pick<JobDTO, "prompt" | "modelName"> & { params: { aspect: string } };
  asset: JobAsset;
  onClose: () => void;
  // In a studio, reuse fills the composer in place; elsewhere it links to the image studio.
  onReuse?: (prompt: string) => void;
  onDelete?: () => Promise<void>;
  isExample?: boolean;
};

// Result view (not observed in the recon, so an assumption): the full image or video, what
// made it and how (generated vs rendered vs sample), download, and the next step.
export function Lightbox({ job, asset, onClose, onReuse, onDelete, isExample }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isVideo = asset.kind === "video";
  const isSample = asset.source === "sample";
  const prompt = asset.prompt ?? job.prompt;
  const cropped = !isVideo && asset.width !== asset.height;
  // The media box is sized from the asset's own dimensions before anything loads (the largest box
  // of that ratio that fits the stage), so the skeleton has exactly the shape of what arrives.
  const ratio = asset.width / asset.height;
  const fit = { aspectRatio: `${asset.width} / ${asset.height}`, width: `min(100cqw, ${ratio} * 100cqh)` };

  return (
    <div role="dialog" aria-modal="true" aria-label={isVideo ? "Video details" : "Image details"} className="fixed inset-0 z-50 flex flex-col bg-black/95 md:flex-row" onClick={onClose}>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-8" style={{ containerType: "size" }}>
        {isVideo ? (
          <SkeletonVideo
            src={asset.url}
            poster={asset.posterUrl ?? undefined}
            controls
            autoPlay
            muted
            loop
            playsInline
            onClick={(e) => e.stopPropagation()}
            style={fit}
            className="rounded-lg"
          />
        ) : (
          <SkeletonImg src={asset.url} alt={prompt} onClick={(e) => e.stopPropagation()} style={fit} className="rounded-lg object-contain" />
        )}
      </div>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[45vh] shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-[#121214] p-4 md:max-h-none md:w-80 md:border-l md:border-t-0 md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {isSample && isVideo ? (
              <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">PRE-RENDERED EXAMPLE</span>
            ) : isSample ? (
              <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">SAMPLE, NOT YOUR PROMPT</span>
            ) : isVideo ? (
              <span className="rounded-md bg-sky-300 px-2 py-0.5 text-xs font-bold text-black">RENDERED CAMERA MOVE</span>
            ) : (
              <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-black">MODEL GENERATED</span>
            )}
            {cropped && !isSample && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">Centre-cropped to {job.params.aspect}</span>}
            {isExample && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">Example from the library</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-white/60 hover:bg-white/10 hover:text-white">
            ×
          </button>
        </div>
        {isVideo && isSample && (
          <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            A pre-rendered example of this camera move over a library image, not rendered from your image. Served because this free-tier deployment limits live rendering to stay within its compute allowance. No credits were charged.
          </p>
        )}
        {isVideo && !isSample && (
          <p className="rounded-lg bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/65">
            Not AI-generated video. A real camera move, rendered frame by frame over the image with ffmpeg.
          </p>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">{isVideo ? "Shot" : "Prompt"}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">{prompt}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-white/40">{isVideo ? "Renderer" : "Model"}</dt>
            <dd>{job.modelName}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Size</dt>
            <dd className="tabular-nums">
              {asset.width}×{asset.height}
              {isVideo && asset.durationMs ? ` · ${Math.round(asset.durationMs / 1000)}s` : ""}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex gap-2">
          <a href={asset.url} download className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15">
            Download
          </a>
          {!isVideo && !isSample && (
            <Link href={`/ai/video?image=${asset.id}`} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15">
              Animate
            </Link>
          )}
          {!isVideo && !isSample &&
            (onReuse ? (
              <button
                type="button"
                onClick={() => {
                  onReuse(prompt);
                  onClose();
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black"
              >
                Reuse
              </button>
            ) : (
              <Link href={`/ai/image?prompt=${encodeURIComponent(prompt)}`} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black">
                Reuse
              </Link>
            ))}
        </div>
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              setDeleting(true);
              await onDelete();
              onClose();
            }}
            className={`h-10 rounded-xl text-sm ${confirmDelete ? "bg-red-500/90 font-semibold text-white" : "text-white/45 hover:bg-white/5 hover:text-red-300"}`}
          >
            {deleting ? "Deleting…" : confirmDelete ? "Tap again to delete" : "Delete"}
          </button>
        )}
      </aside>
    </div>
  );
}
