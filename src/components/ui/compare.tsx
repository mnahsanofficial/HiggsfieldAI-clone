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
  hint,
}: {
  still: { url: string; alt: string };
  take: { url: string; posterUrl?: string | null; label: string };
  width: number;
  height: number;
  stillLabel?: string;
  takeLabel?: string;
  // A short prompt beside the handle ("Drag to compare"), gone once the handle has been moved.
  hint?: string;
}) {
  const [pos, setPosRaw] = useState(50);
  const [moved, setMoved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const setPos = useCallback((next: number | ((p: number) => number)) => {
    setMoved(true);
    setPosRaw(next);
  }, []);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const reduced = useReducedMotion();

  const fromPointer = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
  }, [setPos]);

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
        ref={video}
        src={take.url}
        poster={take.posterUrl ?? undefined}
        muted
        loop
        playsInline
        autoPlay={!reduced}
        aria-label={take.label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <SkeletonImg src={still.url} alt={still.alt} draggable={false} className="h-full w-full object-cover" />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-paper/90 px-2 py-0.5 text-[0.75rem] font-semibold text-ink">{stillLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-paper/90 px-2 py-0.5 text-[0.75rem] font-semibold text-ink">{takeLabel}</span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper" style={{ left: `${pos}%` }} />
      {reduced && (
        // With reduced motion the take holds on its poster. Native controls would sit partly under
        // the still's layer, so the play control is our own, on the camera-move side.
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => (playing ? video.current?.pause() : void video.current?.play())}
          className="absolute bottom-2 right-2 z-10 flex h-10 items-center gap-2 rounded-lg bg-paper/95 px-3 text-[0.875rem] font-semibold text-ink shadow-[0_1px_2px_rgba(20,22,26,.25)]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="currentColor">
            {playing ? <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /> : <path d="M2.5 1.2v9.6L10.5 6z" />}
          </svg>
          {playing ? "Pause the move" : "Play the move"}
        </button>
      )}
      {hint && !moved && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 mt-8 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/85 px-2 py-1 text-[0.75rem] font-semibold text-paper" style={{ left: `${pos}%` }} data-testid="compare-hint">
          {hint}
        </span>
      )}
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
