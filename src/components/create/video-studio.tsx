"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PaywallModal } from "@/components/billing/paywall-modal";
import { GenerateButton } from "@/components/credits/generate-button";
import { priceJob } from "@/lib/credits/pricing";
import { HistoryGrid } from "./history-grid";
import { ImagePickerModal } from "./image-picker";
import { Lightbox } from "./lightbox";
import { PresetGalleryModal } from "./preset-gallery";
import type { JobAsset, JobDTO, PickerImage, RenderPolicy, StudioModel, StudioPreset } from "./types";
import { useJobs } from "./use-jobs";

type Props = {
  model: StudioModel;
  presets: StudioPreset[];
  initialPresetId: string;
  mine: PickerImage[];
  library: PickerImage[];
  initialImage: PickerImage | null;
  initialJobs: JobDTO[];
  signedIn: boolean;
  openGallery?: boolean;
  policy: RenderPolicy;
};

const aspectFor = (img: PickerImage, allowed: string[]) => {
  const want = img.width > img.height * 1.15 ? "16:9" : img.height > img.width * 1.15 ? "9:16" : "1:1";
  return allowed.includes(want) ? want : allowed[0];
};

// Create Video (recon 17): ADD IMAGE -> CHOOSE PRESET -> GET VIDEO, with the params panel on
// the left and History / How it works in the main pane.
export function VideoStudio({ model, presets, initialPresetId, mine, library, initialImage, initialJobs, signedIn: initiallySignedIn, openGallery = false, policy }: Props) {
  const [liveLeft, setLiveLeft] = useState(policy.liveRendersLeft);
  const router = useRouter();
  const caps = model.capabilities;
  const [signedIn, setSignedIn] = useState(initiallySignedIn);
  const { jobs, upsert, refresh } = useJobs("video", initialJobs, signedIn);
  const [preset, setPreset] = useState(presets.find((p) => p.id === initialPresetId) ?? presets[0]);
  const [image, setImage] = useState<PickerImage | null>(initialImage);
  const [aspect, setAspect] = useState(initialImage ? aspectFor(initialImage, caps.aspects) : caps.aspects[0]);
  const [durationS, setDuration] = useState(caps.durations?.[0] ?? 5);
  const [resolution, setResolution] = useState(caps.resolutions[0]);
  const [tab, setTab] = useState<"history" | "how">(initialJobs.length ? "history" : "how");
  const [modal, setModal] = useState<"preset" | "image" | null>(openGallery ? "preset" : null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ job: JobDTO; asset: JobAsset } | null>(null);
  const [paywall, setPaywall] = useState<{ requiredTenths: number; balanceTenths: number } | null>(null);

  const listPrice = priceJob(model.pricing, { resolution, batchSize: 1, durationS });
  // Mirrors the server's render policy so the button says what will happen before the click.
  const prerenderOnly = policy.prerenderOnlyMotions.includes(preset.motionType);
  const willPrerender = policy.mode === "prerendered" || prerenderOnly || liveLeft <= 0;
  const price = willPrerender ? { costTenths: 0, listTenths: 0 } : listPrice;
  const fallbackNote =
    policy.mode === "prerendered"
      ? "Live rendering is paused on this free-tier deployment. You'll get a pre-rendered example of this move, free."
      : prerenderOnly
        ? "This move uses about twice the compute of the others, so it's served as a pre-rendered example, free."
        : liveLeft <= 0
          ? "You've used your live render. Next videos are pre-rendered examples of the move, free."
          : `${liveLeft} live render${liveLeft === 1 ? "" : "s"} left on this free-tier deployment. After that, pre-rendered examples.`;

  const submit = useCallback(async () => {
    if (!image) {
      setModal("image");
      return;
    }
    setError(null);
    setSubmitting(true);
    const post = () =>
      fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: "video", modelId: model.id, presetId: preset.id, inputAssetId: image.id, aspect, resolution, durationS }),
      });
    try {
      let res = await post();
      if (res.status === 401) {
        const guest = await fetch("/api/auth/guest", { method: "POST" });
        const g = (await guest.json()) as { ok: boolean; error?: string };
        if (!g.ok) return setError({ message: g.error ?? "Couldn't start a guest session." });
        setSignedIn(true);
        res = await post();
      }
      const body = await res.json();
      if (res.status === 201) {
        upsert(body.job as JobDTO);
        if ((body.job as JobDTO).costTenths > 0) setLiveLeft((n) => Math.max(0, n - 1));
        setTab("history");
        router.refresh();
      } else if (body.error === "insufficient_credits") {
        setPaywall({ requiredTenths: body.requiredTenths, balanceTenths: body.balanceTenths });
      } else {
        setError({ message: body.message ?? "Something went wrong. Nothing was charged." });
      }
    } catch {
      setError({ message: "Network error. Nothing was charged." });
    } finally {
      setSubmitting(false);
    }
  }, [image, model.id, preset.id, aspect, resolution, durationS, upsert, router]);

  const cancel = useCallback(
    async (job: JobDTO) => {
      setBusyJobId(job.id);
      await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      await refresh();
      router.refresh();
      setBusyJobId(null);
    },
    [refresh, router],
  );

  const retry = useCallback(
    async (job: JobDTO) => {
      setBusyJobId(job.id);
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      const body = await res.json();
      if (res.status === 201) upsert(body.job as JobDTO);
      else setError({ message: body.message ?? "Couldn't retry." });
      router.refresh();
      setBusyJobId(null);
    },
    [upsert, router],
  );

  const howItWorksVideo = presets.find((p) => p.id === "slow-push-in")?.preview ?? preset.preview;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-3 py-4 sm:px-4 lg:flex-row lg:items-start">
      <aside className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#121214] p-3 lg:sticky lg:top-[4.5rem] lg:w-[360px] lg:shrink-0">
        <h1 className="px-1 text-sm font-semibold">Create Video</h1>

        <div className="relative overflow-hidden rounded-xl bg-white/5" style={{ aspectRatio: "16 / 9" }}>
          {preset.preview && <video key={preset.id} src={preset.preview.url} poster={preset.preview.posterUrl ?? undefined} muted loop playsInline autoPlay className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-2.5 left-3">
            <p className="text-lg font-black uppercase leading-none text-accent">{preset.name}</p>
            <p className="mt-1 text-xs text-white/70">{model.name}</p>
          </div>
          <button type="button" onClick={() => setModal("preset")} className="absolute right-2 top-2 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-medium backdrop-blur hover:bg-black/80">
            ✎ Change
          </button>
        </div>

        {image ? (
          <button type="button" onClick={() => setModal("image")} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element -- immutable /media route */}
            <img src={image.url} alt={image.prompt ?? "Selected image"} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0">
              <span className="block text-xs text-white/45">Image to animate</span>
              <span className="line-clamp-2 text-sm text-white/85">{image.prompt ?? "Your image"}</span>
            </span>
            <span className="ml-auto shrink-0 pr-1 text-xs text-white/50 group-hover:text-white">Change</span>
          </button>
        ) : (
          <button type="button" onClick={() => setModal("image")} className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-white/20 px-3 py-6 text-center hover:border-white/40 hover:bg-white/[0.03]">
            <span className="text-2xl">＋</span>
            <span className="text-sm font-medium">Add image</span>
            <span className="text-xs text-white/45">Pick one of yours or from the library</span>
          </button>
        )}

        <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
          <p className="text-xs text-white/45">Model</p>
          <p className="text-sm">{model.name}</p>
          <p className="mt-0.5 text-xs text-white/40">Real camera moves rendered over your image. Not AI-generated video.</p>
        </div>

        <Segmented label="Duration" value={String(durationS)} options={(caps.durations ?? [5]).map((d) => [String(d), `${d}s`])} onChange={(v) => setDuration(Number(v))} />
        <Segmented label="Aspect" value={aspect} options={caps.aspects.map((a) => [a, a])} onChange={setAspect} />
        <Segmented label="Quality" value={resolution} options={caps.resolutions.map((r) => [r, r])} onChange={setResolution} />

        <GenerateButton costTenths={price.costTenths} listTenths={price.listTenths} pending={submitting} label={!image ? "Add image to generate" : willPrerender ? "Get example" : "Generate"} type="button" onClick={submit} className="w-full" />
        <p className={`px-1 text-xs ${willPrerender ? "text-amber-300/90" : "text-white/45"}`}>{fallbackNote}</p>
        {error && (
          <p role="alert" className="px-1 text-sm text-red-400">
            {error.message}
          </p>
        )}
      </aside>

      <section className="min-w-0 flex-1">
        <div className="mb-3 flex gap-1.5" role="tablist">
          {(
            [
              ["history", "History"],
              ["how", "How it works"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 rounded-lg px-3 text-sm ${tab === id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "how" || jobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#121214] p-4 sm:p-8">
            <h2 className="text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">Make videos in one click</h2>
            <p className="mt-2 text-sm text-white/55">{presets.length} camera presets for push-ins, pans, arcs, handheld and focus pulls, rendered over your image.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Step title="Add image" text="Pick an image you generated, or one from the library.">
                {/* eslint-disable-next-line @next/next/no-img-element -- immutable /media route */}
                {library[0] && <img src={(image ?? library[0]).url} alt="" className="h-full w-full object-cover" />}
              </Step>
              <Step title="Choose preset" text="Pick the camera move that directs the shot.">
                {preset.preview && <video src={preset.preview.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />}
              </Step>
              <Step title="Get video" text="A real MP4 you can download, rendered in seconds.">
                {howItWorksVideo && <video src={howItWorksVideo.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />}
              </Step>
            </div>
          </div>
        ) : (
          <HistoryGrid jobs={jobs} onOpen={(job, asset) => setOpen({ job, asset })} onCancel={cancel} onRetry={retry} busyJobId={busyJobId} />
        )}
      </section>

      {modal === "preset" && <PresetGalleryModal presets={presets} selectedId={preset.id} onSelect={setPreset} onClose={() => setModal(null)} />}
      {modal === "image" && (
        <ImagePickerModal
          mine={mine}
          library={library}
          selectedId={image?.id}
          onSelect={(img) => {
            setImage(img);
            setAspect(aspectFor(img, caps.aspects));
          }}
          onClose={() => setModal(null)}
        />
      )}
      {paywall && <PaywallModal requiredTenths={paywall.requiredTenths} balanceTenths={paywall.balanceTenths} onClose={() => setPaywall(null)} />}
      {open && <Lightbox job={open.job} asset={open.asset} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-xs text-white/45">{label}</span>
      <div className="flex rounded-lg bg-white/5 p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-8 min-w-12 rounded-md px-2.5 text-sm tabular-nums transition ${value === v ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-white/5">{children}</div>
      <p className="mt-3 text-sm font-bold uppercase">{title}</p>
      <p className="mt-1 text-xs text-white/50">{text}</p>
    </div>
  );
}
