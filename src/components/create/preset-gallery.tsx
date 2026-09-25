"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudioPreset } from "./types";
import { SkeletonVideo } from "@/components/media/skeleton-media";


// Preset gallery (recon 17 shows "Change" and "View all presets" but never opened them, so
// the layout is an assumption): category filter plus a grid of looping previews rendered by
// the same camera renderer users get.
export function PresetGrid({ presets, selectedId, onSelect }: { presets: StudioPreset[]; selectedId?: string; onSelect: (p: StudioPreset) => void }) {
  const [category, setCategory] = useState("all");
  // The filters are whatever categories the presets in the database actually have.
  const categories = useMemo(
    () => [{ id: "all", label: "All" }, ...[...new Set(presets.map((p) => p.category))].map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))],
    [presets],
  );
  const shown = useMemo(() => (category === "all" ? presets : presets.filter((p) => p.category === category)), [presets, category]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Preset categories">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm transition ${category === c.id ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            aria-pressed={selectedId === p.id}
            className={`group overflow-hidden rounded-xl border text-left transition ${selectedId === p.id ? "border-accent" : "border-white/10 hover:border-white/30"}`}
          >
            <div className="relative aspect-video bg-white/5">
              {p.preview && (
                <SkeletonVideo src={p.preview.url} poster={p.preview.posterUrl ?? undefined} muted loop playsInline autoPlay preload="metadata" className="h-full w-full object-cover" />
              )}
              {selectedId === p.id && <span className="absolute right-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-black">SELECTED</span>}
              {(p.motionType === "arc" || p.motionType === "rack_focus") && (
                <span className="absolute left-2 top-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">PRE-RENDERED</span>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-sm font-semibold uppercase tracking-tight">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{p.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PresetGalleryModal({ presets, selectedId, onSelect, onClose }: { presets: StudioPreset[]; selectedId?: string; onSelect: (p: StudioPreset) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose a preset" className="fixed inset-0 z-50 flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full flex-col gap-4 overflow-hidden rounded-t-3xl border border-white/10 bg-[#121214] p-4 sm:max-w-5xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tight">Choose a camera move</h2>
            <p className="text-xs text-white/50">Every preview is real renderer output. Presets don&apos;t change the price.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-white/60 hover:bg-white/10">
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          <PresetGrid
            presets={presets}
            selectedId={selectedId}
            onSelect={(p) => {
              onSelect(p);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
