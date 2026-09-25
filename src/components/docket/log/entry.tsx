"use client";

import type { ReactNode } from "react";
import { SkeletonImg, SkeletonVideo } from "@/components/media/skeleton-media";
import { Amount } from "@/components/ui/amount";
import { Button, buttonClass } from "@/components/ui/button";
import { Compare } from "@/components/ui/compare";
import { Tag } from "@/components/ui/tag";
import { formatCredits } from "@/lib/credits/format";
import type { LogAsset, LogEntry } from "@/lib/log/entries";
import { LocalTime } from "./local-time";

// One run in the log. The media leads and is the largest thing; the receipt (model, cost,
// timing) is a quiet line beneath it. A camera move shows the still and the take under the
// drag handle, and the still is always the one the take was really rendered over.

const FALLBACK_NOTE: Record<string, string> = {
  kill_switch: "Live rendering is paused on this free-tier deployment, so this is a pre-rendered example of the move, over a library still.",
  render_cap: "You've used your live renders on this free-tier deployment, so this is a pre-rendered example of the move, over a library still.",
  expensive_preset: "This move costs about twice the compute of the others, so it's served as a pre-rendered example, over a library still.",
};

const ratio = (aspect: string | null | undefined, fallback = "1 / 1") => (aspect ? aspect.replace(":", " / ") : fallback);

// Media never grows past a comfortable height: tall 9:16 frames stay narrow instead of huge.
function mediaBox(width: number, height: number, maxH = 560) {
  return { aspectRatio: `${width} / ${height}`, width: `min(100%, ${Math.round((maxH * width) / height)}px)` };
}

function seconds(e: LogEntry) {
  if (!e.finishedAt) return null;
  const s = (new Date(e.finishedAt).getTime() - new Date(e.createdAt).getTime()) / 1000;
  return s < 0.05 ? null : s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}

export function Entry({
  entry: e,
  isNew = false,
  busy = false,
  onMoveCamera,
  onCancel,
  onRetry,
  footer,
}: {
  entry: LogEntry;
  isNew?: boolean;
  busy?: boolean;
  onMoveCamera?: (still: LogAsset) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  footer?: ReactNode;
}) {
  const running = e.status === "queued" || e.status === "processing";
  const failed = e.status === "failed" || e.status === "canceled";
  const video = e.vertical === "video";
  const take = e.assets.find((a) => a.kind === "video");
  const images = e.assets.filter((a) => a.kind === "image");
  const aspect = (e.params?.aspect as string | undefined) ?? null;
  const took = seconds(e);
  const plural = !video && ((e.params?.batchSize as number | undefined) ?? 1) > 1;
  const making = video ? "Rendering the move" : plural ? "Making the images" : "Making the image";
  const title = video ? (e.presetName ?? "Camera move") : e.prompt;

  return (
    <article className={`flex flex-col gap-3 ${isNew ? "entry-new" : ""}`} aria-busy={running || undefined} data-entry={e.id}>
      {/* Media first */}
      {running ? (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: ratio(aspect), maxWidth: aspect === "9:16" ? 315 : undefined }}>
          <div className="skeleton skeleton-live absolute inset-0" />
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-paper/70" role="progressbar" aria-valuenow={e.progress} aria-valuemin={0} aria-valuemax={100} aria-label={making}>
              <div className="h-full rounded-full bg-live transition-[width] duration-700" style={{ width: `${Math.max(e.progress, 6)}%` }} />
            </div>
          </div>
        </div>
      ) : failed ? null : video && take ? (
        e.renderedFrom ? (
          <div style={{ width: mediaBox(take.width, take.height).width }}>
            <Compare
              still={{ url: e.renderedFrom.url, alt: e.renderedFrom.prompt ?? "The still" }}
              take={{ url: take.url, posterUrl: take.posterUrl, label: `${e.presetName ?? "Camera move"} rendered over the still` }}
              width={take.width}
              height={take.height}
              stillLabel={e.servedAs === "prerendered" ? "Library still" : "Still"}
            />
          </div>
        ) : (
          <SkeletonVideo src={take.url} poster={take.posterUrl ?? undefined} controls muted loop playsInline className="rounded-xl" style={mediaBox(take.width, take.height)} />
        )
      ) : images.length === 1 ? (
        <SkeletonImg src={images[0].url} alt={e.prompt} className="rounded-xl object-cover" style={mediaBox(images[0].width, images[0].height)} />
      ) : images.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.map((a) => (
            <SkeletonImg key={a.id} src={a.url} alt={e.prompt} className="w-full rounded-xl object-cover" style={{ aspectRatio: `${a.width} / ${a.height}` }} />
          ))}
        </div>
      ) : null}

      {/* The receipt, quietly */}
      <div className={`flex flex-col gap-1.5 ${failed ? "rounded-xl bg-field p-4" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <p className="t-body line-clamp-2 min-w-0 font-medium">{running ? making : failed ? (e.status === "canceled" ? "You stopped this run" : video ? "The move didn't render" : plural ? "The images weren't made" : "The image wasn't made") : title}</p>
          <span className="shrink-0 pt-0.5 text-[0.875rem]">
            {running ? <span className="t-meta">{e.progress}%</span> : e.type === "library" ? <Tag>From the library</Tag> : <Amount tenths={e.settlement === "refunded" ? e.refundedTenths : e.chargedTenths} as={e.settlement} />}
          </span>
        </div>
        {failed && <p className="t-body text-ink">{e.status === "canceled" ? "Nothing was made, and your credits went back." : e.errorMessage}</p>}
        {(running || failed || video) && e.prompt && (
          <p className="t-meta line-clamp-2">{video ? (e.servedAs === "prerendered" ? `You chose: ${e.inputAsset?.prompt ?? "your image"}` : e.inputAsset?.prompt ?? "") : e.prompt}</p>
        )}
        <p className="t-meta flex flex-wrap gap-x-3 gap-y-0.5">
          <span>{video && e.servedAs === "live" ? `${e.modelName}, rendered with ffmpeg` : e.modelName}</span>
          {aspect && <span>{aspect}</span>}
          {video && typeof e.params?.durationS === "number" && <span>{`${e.params.durationS} s, ${e.params.resolution as string}`}</span>}
          {took && <span>{`took ${took}`}</span>}
          <LocalTime iso={e.createdAt} withDate />
        </p>
        {e.servedAs === "prerendered" && (
          <div className="mt-1 flex flex-col items-start gap-1.5">
            <Tag tone="outline">Pre-rendered example</Tag>
            <p className="t-meta">{FALLBACK_NOTE[e.fallbackReason ?? "render_cap"]} Nothing was charged.</p>
          </div>
        )}
      </div>

      {/* What you can do next */}
      <div className="flex flex-wrap gap-2">
        {running && onCancel && (
          <Button size="sm" variant="secondary" onClick={onCancel} pending={busy}>
            Cancel
          </Button>
        )}
        {failed && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} pending={busy}>
            Try again{e.costTenths ? `, ${formatCredits(e.costTenths)} credits` : ""}
          </Button>
        )}
        {!running && !failed && !video && images[0] && onMoveCamera && (
          <Button size="sm" onClick={() => onMoveCamera(images[0])}>
            Move the camera over this
          </Button>
        )}
        {!running && !failed && (take ?? images[0]) && (
          <a href={(take ?? images[0]).url} download className={buttonClass("secondary", "sm")}>
            Download
          </a>
        )}
        {footer}
      </div>
    </article>
  );
}
