"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Lightbox } from "@/components/create/lightbox";
import type { JobAsset } from "@/components/create/types";

export type LibraryAsset = JobAsset & {
  jobId: string | null;
  modelName: string | null;
  aspect: string;
  createdAt: string;
};

const FILTERS = [
  ["all", "All"],
  ["image", "Images"],
  ["video", "Videos"],
] as const;

// Assets (recon §5: the nav item was never opened, so this layout is an assumption): everything
// the user made, newest first, one grid, filterable by type. Examples copied in at signup carry
// an "Example" badge so they never pass as the user's own work.
export function AssetLibrary({ initial }: { initial: LibraryAsset[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState<LibraryAsset | null>(null);
  const shown = useMemo(() => (filter === "all" ? items : items.filter((a) => a.kind === filter)), [items, filter]);
  const counts = { all: items.length, image: items.filter((a) => a.kind === "image").length, video: items.filter((a) => a.kind === "video").length };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Filter assets">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={`h-9 rounded-full px-4 text-sm ${filter === id ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            >
              {label} <span className="opacity-50">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/ai/image" className="flex h-9 items-center rounded-lg bg-white/5 px-3 hover:bg-white/10">
            + Image
          </Link>
          <Link href="/ai/video" className="flex h-9 items-center rounded-lg bg-white/5 px-3 hover:bg-white/10">
            + Video
          </Link>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/50">
          Nothing here yet.{" "}
          <Link href={filter === "video" ? "/ai/video" : "/ai/image"} className="text-accent underline">
            Create {filter === "video" ? "a video" : "something"}
          </Link>
        </p>
      ) : (
        <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5">
          {shown.map((a) => {
            const example = a.jobId === null && a.source === "generated";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setOpen(a)}
                className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl bg-white/5 text-left"
                style={{ aspectRatio: `${a.width} / ${a.height}` }}
              >
                {a.kind === "video" ? (
                  <video
                    src={a.url}
                    poster={a.posterUrl ?? undefined}
                    muted
                    loop
                    playsInline
                    preload="none"
                    onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                    className="h-full w-full object-cover"
                    aria-label={a.prompt ?? "Video"}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- immutable /media route
                  <img src={a.url} alt={a.prompt ?? "Image"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                )}
                <span className="absolute left-2 top-2 flex gap-1">
                  {example && <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85 backdrop-blur">Example</span>}
                  {a.kind === "video" && (
                    <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                      ▶ {Math.round((a.durationMs ?? 0) / 1000)}s · Rendered
                    </span>
                  )}
                </span>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-xs text-white/85 opacity-0 transition group-hover:opacity-100">
                  {a.prompt}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <Lightbox
          job={{ prompt: open.prompt ?? "", modelName: open.modelName ?? "", params: { aspect: open.aspect } }}
          asset={open}
          isExample={open.jobId === null && open.source === "generated"}
          onClose={() => setOpen(null)}
          onDelete={async () => {
            const res = await fetch(`/api/assets/${open.id}`, { method: "DELETE" });
            if (res.ok) setItems((prev) => prev.filter((x) => x.id !== open.id));
          }}
        />
      )}
    </>
  );
}
