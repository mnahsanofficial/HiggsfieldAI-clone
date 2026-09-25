"use client";

import { useCallback, useRef, useState } from "react";
import { SkeletonImg, SkeletonVideo } from "@/components/media/skeleton-media";
import { useReducedMotion } from "./use-reduced-motion";

// The still and the camera move over it, one on top of the other, with a divider the user
// drags to compare them. Taken from Direction 3. It moves only when the user moves it: no
// automatic sweep, because the commit is the product's one orchestrated animation.
// Keyboard: the handle is a slider (arrows, Home, End).
export function Compare({
  still,
  take,
  width,
  height,
  stillLabel = "Still",
  takeLabel = "Camera move",
}: {
  still: { url: string; alt: string };
  take: { url: string; posterUrl?: string | null; label: string };
  width: number;
  height: number;
  stillLabel?: string;
  takeLabel?: string;
}) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const reduced = useReducedMotion();

  const fromPointer = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
  }, []);

  return (
    <div
      ref={box}
      className="relative w-full touch-pan-y select-none overflow-hidden rounded-xl bg-ink"
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <SkeletonVideo
        src={take.url}
        poster={take.posterUrl ?? undefined}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        controls={reduced}
        aria-label={take.label}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <SkeletonImg src={still.url} alt={still.alt} draggable={false} className="h-full w-full object-cover" />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-paper/90 px-2 py-0.5 text-[0.75rem] font-semibold text-ink">{stillLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-paper/90 px-2 py-0.5 text-[0.75rem] font-semibold text-ink">{takeLabel}</span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper" style={{ left: `${pos}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={`Compare ${stillLabel.toLowerCase()} and ${takeLabel.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pos}
        aria-valuetext={`${pos}% ${stillLabel.toLowerCase()}`}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 20 : 5;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") setPos((p) => Math.max(0, p - step));
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") setPos((p) => Math.min(100, p + step));
          else if (e.key === "Home") setPos(0);
          else if (e.key === "End") setPos(100);
          else return;
          e.preventDefault();
        }}
        className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-paper text-ink shadow-[0_1px_2px_rgba(20,22,26,.35)]"
        style={{ left: `${pos}%` }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 4.5 2 9l4.5 4.5M11.5 4.5 16 9l-4.5 4.5" />
        </svg>
      </button>
    </div>
  );
}
