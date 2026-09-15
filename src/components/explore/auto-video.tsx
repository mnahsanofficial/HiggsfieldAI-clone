"use client";

import { useEffect, useRef } from "react";
import { SkeletonVideo } from "@/components/media/skeleton-media";

// A muted looping preview that only plays while on screen, so a dense page of videos doesn't
// decode dozens of streams at once on a phone.
export function AutoVideo({ src, poster, className = "" }: { src: string; poster?: string | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { rootMargin: "100px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <SkeletonVideo ref={ref} src={src} poster={poster ?? undefined} muted loop playsInline preload="none" className={className} />;
}
