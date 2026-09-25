"use client";

import { SkeletonImg, SkeletonVideo } from "@/components/media/skeleton-media";
import { Button, ButtonLink } from "@/components/ui/button";
import { CostMeter, type MeterState } from "@/components/ui/cost-meter";
import { Field, TextArea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useReducedMotion } from "@/components/ui/use-reduced-motion";
import { formatCredits } from "@/lib/credits/format";
import type { MakeModel, MakeMove, MakeStill } from "@/lib/docket/make-data";
import type { ImageQuota } from "@/lib/jobs/image-quota";
import { ROUTES } from "../routes";

export type Mode = "image" | "move";

export type ComposerProps = {
  mode: Mode;
  onMode: (m: Mode) => void;
  image: MakeModel;
  video: MakeModel;
  prompt: string;
  onPrompt: (p: string) => void;
  aspect: string;
  onAspect: (a: string) => void;
  batch: number;
  onBatch: (n: number) => void;
  quota: ImageQuota;
  still: MakeStill | null;
  move: MakeMove;
  moveAspect: string;
  onChooseStill: () => void;
  onChooseMove: () => void;
  costTenths: number;
  balanceTenths: number;
  meter: MeterState;
  willPrerender: boolean;
  liveLeft: number;
  prerenderReason: string | null;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
};

// The make box. Two modes of one loop: make an image, then move the camera over it. The price
// is drawn against your balance before you press anything.
export function Composer(p: ComposerProps) {
  const reduced = useReducedMotion();
  const allowance = Math.min(p.quota.siteLeft, p.quota.yoursLeft);
  const outOfImages = p.mode === "image" && allowance === 0;
  // Out of today's images is the real blocker then: more credits wouldn't help.
  const short = p.costTenths > p.balanceTenths && !outOfImages;
  const canSubmit = p.mode === "image" ? p.prompt.trim().length > 0 && !outOfImages : !!p.still;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !short) p.onSubmit();
      }}
      aria-labelledby="make-heading"
    >
      <h1 id="make-heading" className="t-title">
        Make
      </h1>
      <Segmented
        name="mode"
        label="What to make"
        hideLabel
        value={p.mode}
        onChange={p.onMode}
        options={[
          { value: "image", label: "Image" },
          { value: "move", label: "Camera move" },
        ]}
      />

      {p.mode === "image" ? (
        <>
          <Field id="prompt" label="Describe the image" hint={`${p.image.name} makes a 1024 by 1024 image. Other aspects are a centre crop of it.`}>
            <TextArea
              id="prompt"
              value={p.prompt}
              maxLength={2000}
              rows={4}
              placeholder="A lighthouse on black rocks at dusk, storm clouds, long exposure"
              onChange={(e) => p.onPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (canSubmit && !short) p.onSubmit();
                }
              }}
              aria-describedby="prompt-hint"
            />
          </Field>
          <Segmented name="aspect" label="Aspect" value={p.aspect} onChange={p.onAspect} options={p.image.aspects.map((a) => ({ value: a, label: a }))} />
          {p.image.maxBatch > 1 && (
            <Segmented
              name="batch"
              label="How many"
              value={String(p.batch)}
              onChange={(v) => p.onBatch(Number(v))}
              options={Array.from({ length: p.image.maxBatch }, (_, i) => ({ value: String(i + 1), label: String(i + 1), disabled: i + 1 > Math.max(1, allowance) }))}
            />
          )}
          {p.image.maxBatch > 1 && allowance > 0 && allowance < p.image.maxBatch && (
            <p className="t-meta -mt-2" data-testid="batch-limit">
              You can make {allowance} more {allowance === 1 ? "image" : "images"} today, so {allowance === 1 ? "only 1 is" : `up to ${allowance} are`} available.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="t-label">Image to animate</p>
            {p.still ? (
              <button type="button" onClick={p.onChooseStill} className="flex items-center gap-3 rounded-xl bg-field p-2 text-left hover:bg-[#e6e7e2]">
                <SkeletonImg src={p.still.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <span className="t-meta line-clamp-2 min-w-0 flex-1 !text-ink">{p.still.prompt ?? "Your image"}</span>
                <span className="shrink-0 pr-2 text-[0.8125rem] font-semibold">Change</span>
              </button>
            ) : (
              <Button variant="secondary" onClick={p.onChooseStill} className="justify-start">
                Choose an image
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="t-label">Camera move</p>
            <button type="button" onClick={p.onChooseMove} className="flex items-center gap-3 rounded-xl bg-field p-2 text-left hover:bg-[#e6e7e2]">
              <span className="block h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-paper">
                {p.move.preview && (
                  <SkeletonVideo key={p.move.id} src={p.move.preview.url} poster={p.move.preview.posterUrl ?? undefined} muted loop playsInline autoPlay={!reduced} aria-hidden className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold">{p.move.name}</span>
                <span className="t-meta line-clamp-1">{p.move.description}</span>
              </span>
              <span className="shrink-0 pr-2 text-[0.8125rem] font-semibold">Change</span>
            </button>
          </div>
          <p className="t-meta">
            {`${p.video.durations[0] ?? 5} seconds at ${p.video.resolutions[0]}, ${p.moveAspect} to match the image, rendered with ffmpeg over the still.`}
          </p>
          <p className="t-meta" role="note">
            {p.willPrerender
              ? p.prerenderReason
              : `${p.liveLeft} live ${p.liveLeft === 1 ? "render" : "renders"} left on this free-tier deployment. After that, moves come as free pre-rendered examples.`}
          </p>
        </>
      )}

      <div className="flex flex-col gap-3">
        {p.mode === "image" && <ImageAllowance quota={p.quota} />}
        {!outOfImages && <CostMeter costTenths={p.costTenths} balanceTenths={p.balanceTenths} state={p.meter} note={p.mode === "move" && p.willPrerender ? "(a pre-rendered example)" : undefined} />}
        {short ? (
          <>
            <p className="t-body">
              This costs {formatCredits(p.costTenths)} credits and you have {formatCredits(p.balanceTenths)}. Nothing has been charged.
            </p>
            <ButtonLink href={ROUTES.credits} size="lg">
              Get more credits
            </ButtonLink>
          </>
        ) : (
          <Button type="submit" size="lg" pending={p.pending} disabled={!canSubmit}>
            {p.mode === "image" ? (p.batch > 1 ? "Make the images" : "Make the image") : p.willPrerender ? "Get the example" : "Render the move"}
          </Button>
        )}
        {p.error && (
          <p role="alert" className="t-body text-charged">
            {p.error}
          </p>
        )}
      </div>
    </form>
  );
}

// The real numbers for the free image allowance: what's left for everyone today, and for you.
export function ImageAllowance({ quota: q }: { quota: ImageQuota }) {
  const plural = (n: number) => (n === 1 ? "image" : "images");
  let line;
  if (!q.testMode && q.siteLeft === 0) {
    line = (
      <>
        <span className="font-semibold text-ink">No free images left today.</span> The daily limit for this deployment resets at 00:00 UTC, in {q.resetsIn}. Camera moves don&apos;t use it, so they still work.
      </>
    );
  } else if (q.yoursLeft === 0) {
    line = (
      <>
        <span className="font-semibold text-ink">You&apos;ve made your {q.perVisitor} images for today.</span> More at 00:00 UTC, in {q.resetsIn}. Camera moves still work.
        {!q.testMode && ` ${q.siteLeft} ${plural(q.siteLeft)} left for everyone else.`}
      </>
    );
  } else if (q.testMode) {
    line = (
      <>
        <span className="font-semibold text-ink">Test mode:</span> images come from the test fixture, so the daily allowance isn&apos;t spent. You can make {q.yoursLeft} more today.
      </>
    );
  } else {
    line = (
      <>
        <span className="font-semibold text-ink">
          {q.siteLeft} free {plural(q.siteLeft)} left today
        </span>{" "}
        on this deployment, of {q.siteCapacity}. You can make {Math.min(q.yoursLeft, q.siteLeft)} more.
      </>
    );
  }
  return (
    <p className="t-meta" role="status" data-quota={`${q.siteLeft}/${q.siteCapacity}/${q.yoursLeft}`}>
      {line}
    </p>
  );
}
