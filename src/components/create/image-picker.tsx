"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PickerImage } from "./types";
import { SkeletonImg } from "@/components/media/skeleton-media";

type Props = {
  mine: PickerImage[];
  library: PickerImage[];
  selectedId?: string;
  onSelect: (img: PickerImage) => void;
  onClose: () => void;
};

// ADD IMAGE (recon 17): pick one of your own images or a library image to animate. Device
// upload is out of scope for this build; generating an image first is one click away.
export function ImagePickerModal({ mine, library, selectedId, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"mine" | "library">(mine.length ? "mine" : "library");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const images = tab === "mine" ? mine : library;

  return (
    <div role="dialog" aria-modal="true" aria-label="Add an image" className="fixed inset-0 z-50 flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full flex-col gap-4 overflow-hidden rounded-t-3xl border border-white/10 bg-[#121214] p-4 sm:max-w-4xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tight">Add image</h2>
            <p className="text-xs text-white/50">
              Choose the still to animate.{" "}
              <Link href="/ai/image" className="text-accent underline">
                Generate a new one
              </Link>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-white/60 hover:bg-white/10">
            ×
          </button>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {(
            [
              ["mine", `Your images (${mine.length})`],
              ["library", `Library (${library.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-full px-4 text-sm ${tab === id ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 overflow-y-auto">
          {images.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/50">
              No images yet.{" "}
              <Link href="/ai/image" className="text-accent underline">
                Generate one
              </Link>{" "}
              or pick from the library.
            </p>
          ) : (
            <div className="columns-3 gap-2 sm:columns-4 lg:columns-5">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    onSelect(img);
                    onClose();
                  }}
                  className={`relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg border-2 ${selectedId === img.id ? "border-accent" : "border-transparent hover:border-white/40"}`}
                  style={{ aspectRatio: `${img.width} / ${img.height}` }}
                >
                  <SkeletonImg src={img.url} alt={img.prompt ?? "Image"} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
