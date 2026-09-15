"use client";

import Link from "next/link";
import { useRef } from "react";
import { GenerateButton } from "@/components/credits/generate-button";
import { priceJob } from "@/lib/credits/pricing";
import type { StudioModel } from "./types";

export type ComposerState = { prompt: string; modelId: string; aspect: string; batchSize: number };

type Props = {
  models: StudioModel[];
  state: ComposerState;
  onChange: (next: Partial<ComposerState>) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: { message: string; outOfCredits?: boolean } | null;
};

const ASPECT_LABEL: Record<string, string> = { "1:1": "1:1", "16:9": "16:9", "9:16": "9:16", "4:3": "4:3", "3:4": "3:4" };

// Floating bottom composer (recon 16): prompt, model, aspect, resolution, batch, and a
// Generate button that prices itself before you commit. Native selects keep the phone
// pickers.
export function ImageComposer({ models, state, onChange, onSubmit, submitting, error }: Props) {
  const model = models.find((m) => m.id === state.modelId) ?? models[0];
  const caps = model.capabilities;
  const resolution = caps.resolutions[0];
  const price = priceJob(model.pricing, { resolution, batchSize: state.batchSize });
  const valid = state.prompt.trim().length >= 3;
  const textarea = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !submitting) onSubmit();
      }}
      className="rounded-2xl border border-white/10 bg-[#161618]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur"
    >
      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      <textarea
        id="prompt"
        ref={textarea}
        value={state.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (valid && !submitting) onSubmit();
          }
        }}
        rows={2}
        maxLength={2000}
        placeholder="Describe the scene you imagine"
        className="block max-h-40 min-h-[3.25rem] w-full resize-none bg-transparent px-1 text-base leading-relaxed outline-none placeholder:text-white/35"
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Chip label="Model">
            <select value={model.id} onChange={(e) => onChange({ modelId: e.target.value })} className="chip-select">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Chip>
          <Chip label="Aspect ratio">
            <select value={state.aspect} onChange={(e) => onChange({ aspect: e.target.value })} className="chip-select">
              {caps.aspects.map((a) => (
                <option key={a} value={a}>
                  {ASPECT_LABEL[a] ?? a}
                </option>
              ))}
            </select>
          </Chip>
          <span
            className="flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/70"
            title={`${model.name} outputs ${resolution} (1024×1024); other aspects are a centre crop.`}
          >
            {resolution}
          </span>
          <div className="flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/5 text-sm" aria-label="Batch size">
            <button
              type="button"
              aria-label="Fewer images"
              disabled={state.batchSize <= 1}
              onClick={() => onChange({ batchSize: state.batchSize - 1 })}
              className="grid h-full w-8 place-items-center text-white/60 hover:text-white disabled:opacity-30"
            >
              −
            </button>
            <span className="w-9 text-center tabular-nums">
              {state.batchSize}/{caps.maxBatch}
            </span>
            <button
              type="button"
              aria-label="More images"
              disabled={state.batchSize >= caps.maxBatch}
              onClick={() => onChange({ batchSize: state.batchSize + 1 })}
              className="grid h-full w-8 place-items-center text-white/60 hover:text-white disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
        <GenerateButton costTenths={price.costTenths} listTenths={price.listTenths} disabled={!valid} pending={submitting} className="w-full sm:w-auto" />
      </div>

      {error && (
        <p role="alert" className="mt-2 px-1 text-sm text-red-400">
          {error.message}{" "}
          {error.outOfCredits && (
            <Link href="/credits" className="text-accent underline">
              View credits
            </Link>
          )}
        </p>
      )}
    </form>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="relative flex h-9 shrink-0 items-center rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10">
      <span className="sr-only">{label}</span>
      {children}
      <span aria-hidden className="pointer-events-none absolute right-2.5 text-[10px] text-white/50">
        ▼
      </span>
    </label>
  );
}
