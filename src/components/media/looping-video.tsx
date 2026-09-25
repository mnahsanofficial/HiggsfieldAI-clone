"use client";

import { type CSSProperties, useRef, useState } from "react";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { SkeletonVideo } from "./skeleton-media";

// A short clip that shows itself: muted, looping, inline, no native controls. With reduced
// motion it holds on the poster and offers one play button instead of moving on its own.
export function LoopingVideo({ src, poster, label, className = "", style }: { src: string; poster?: string | null; label: string; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!reduced) {
    return <SkeletonVideo key="auto" src={src} poster={poster ?? undefined} autoPlay muted loop playsInline preload="auto" aria-label={label} className={className} style={style} />;
  }
  return (
    <div className="relative" style={style}>
      <SkeletonVideo key="still" ref={ref} src={src} poster={poster ?? undefined} muted loop playsInline preload="none" aria-label={label} className={`${className} h-full w-full`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button
        type="button"
        onClick={() => (playing ? ref.current?.pause() : void ref.current?.play())}
        className="absolute bottom-3 left-3 flex h-10 items-center gap-2 rounded-lg bg-paper/95 px-3 text-[0.875rem] font-semibold text-ink shadow-[0_1px_2px_rgba(20,22,26,.25)]"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="currentColor">
          {playing ? <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /> : <path d="M2.5 1.2v9.6L10.5 6z" />}
        </svg>
        {playing ? "Pause the move" : "Play the move"}
      </button>
    </div>
  );
}
