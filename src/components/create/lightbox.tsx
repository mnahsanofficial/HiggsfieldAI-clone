"use client";

import { useEffect } from "react";
import type { JobAsset, JobDTO } from "./types";

type Props = {
  job: JobDTO;
  asset: JobAsset;
  onClose: () => void;
  onReuse: (prompt: string) => void;
};

// Result view (not observed in the recon, so an assumption): full image, what made it,
// how it was produced, download, and reuse the prompt.
export function Lightbox({ job, asset, onClose, onReuse }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isSample = asset.source === "sample";
  const prompt = asset.prompt ?? job.prompt;
  const cropped = asset.width !== asset.height;

  return (
    <div role="dialog" aria-modal="true" aria-label="Image details" className="fixed inset-0 z-50 flex flex-col bg-black/95 md:flex-row" onClick={onClose}>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 md:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- immutable /media route */}
        <img src={asset.url} alt={prompt} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[45vh] shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 bg-[#121214] p-4 md:max-h-none md:w-80 md:border-l md:border-t-0 md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {isSample ? (
              <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">SAMPLE, NOT YOUR PROMPT</span>
            ) : (
              <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-black">MODEL GENERATED</span>
            )}
            {cropped && !isSample && <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">Centre-cropped to {job.params.aspect}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-white/60 hover:bg-white/10 hover:text-white">
            ×
          </button>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">Prompt</p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">{prompt}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-white/40">Model</dt>
            <dd>{job.modelName}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/40">Size</dt>
            <dd className="tabular-nums">
              {asset.width}×{asset.height}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex gap-2">
          <a href={asset.url} download className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15">
            Download
          </a>
          <button
            type="button"
            onClick={() => {
              onReuse(prompt);
              onClose();
            }}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-black"
          >
            Reuse prompt
          </button>
        </div>
      </aside>
    </div>
  );
}
