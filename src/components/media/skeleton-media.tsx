"use client";

import { type ImgHTMLAttributes, useCallback, useEffect, useState, type VideoHTMLAttributes } from "react";

// Media that shows a shimmering skeleton in its own box until the first frame is painted. The
// box is whatever the element is laid out as (tiles set their aspect ratio from the asset's real
// dimensions), so the skeleton always matches the shape of what arrives. The shimmer stops once
// loaded so a page of tiles isn't repainting forever.

export function SkeletonImg({ className = "", onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  // A cached image can finish before hydration attaches onLoad.
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- immutable /media route; alt comes through props
    <img
      ref={ref}
      {...props}
      data-loaded={loaded || undefined}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setLoaded(true);
        onError?.(e);
      }}
      className={`${className} ${loaded ? "" : "skeleton"}`}
    />
  );
}

export function SkeletonVideo({ className = "", poster, onLoadedData, ref: externalRef, ...props }: VideoHTMLAttributes<HTMLVideoElement> & { ref?: React.Ref<HTMLVideoElement> }) {
  const [loaded, setLoaded] = useState(false);
  // With preload="none" only the poster ever paints, and a poster has no load event of its own.
  useEffect(() => {
    if (!poster) return;
    const img = new Image();
    img.onload = img.onerror = () => setLoaded(true);
    img.src = poster;
  }, [poster]);
  return (
    <video
      ref={externalRef}
      {...props}
      poster={poster}
      data-loaded={loaded || undefined}
      onLoadedData={(e) => {
        setLoaded(true);
        onLoadedData?.(e);
      }}
      className={`${className} ${loaded ? "" : "skeleton"}`}
    />
  );
}

// Placeholder blocks for route loading states.
export function SkeletonBlock({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`skeleton ${className}`} style={style} />;
}

// A masonry grid of placeholder tiles in the given aspect ratios, laid out like the real grids.
export function SkeletonMasonry({ ratios, columns = "columns-2 sm:columns-3 lg:columns-4 xl:columns-5", rounded = "rounded-xl" }: { ratios: string[]; columns?: string; rounded?: string }) {
  return (
    <div className={`${columns} gap-2`} aria-hidden>
      {ratios.map((r, i) => (
        <div key={i} className={`skeleton mb-2 break-inside-avoid ${rounded}`} style={{ aspectRatio: r }} />
      ))}
    </div>
  );
}
