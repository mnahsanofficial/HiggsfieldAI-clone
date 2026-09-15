import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import type { Tx } from "@/lib/credits/ledger";
import { generationJobs, type PresetMotion, systemEvents } from "@/db/schema";

// Who gets a live ffmpeg render, and who gets a labelled pre-rendered example instead.
//
// Every live render is real CPU inside a Vercel Function, and this deployment exhausted the
// Hobby Fluid Active CPU allowance (4h/month) during the build. So:
//  - kill switch: render mode can be set to "prerendered" at runtime. The source of truth is
//    the latest `render_mode` row in system_events (flip with scripts/ops/render-mode.ts, no
//    deploy). VIDEO_RENDER_MODE=prerendered forces it at deploy time too.
//  - live renders are capped per account: guests 1, registered 3.
//  - the two expensive moves (arc and rack focus, ~2x the CPU of the rest) are pre-rendered only.
// A pre-rendered example is never charged and is labelled as what it is.

export type RenderMode = "live" | "prerendered";
export type FallbackReason = "kill_switch" | "render_cap" | "expensive_preset";
export type RenderDecision = { live: true } | { live: false; reason: FallbackReason };

export const LIVE_RENDER_CAP = { guest: 1, registered: 3 } as const;
export const PRERENDER_ONLY_MOTIONS: PresetMotion["type"][] = ["arc", "rack_focus"];

let cached: { mode: RenderMode; at: number } | null = null;

export async function getRenderMode(): Promise<RenderMode> {
  if (process.env.VIDEO_RENDER_MODE === "prerendered") return "prerendered";
  if (cached && Date.now() - cached.at < 10_000) return cached.mode;
  const [row] = await db
    .select({ detail: systemEvents.detail })
    .from(systemEvents)
    .where(eq(systemEvents.kind, "render_mode"))
    .orderBy(desc(systemEvents.createdAt))
    .limit(1);
  const mode: RenderMode = row?.detail?.mode === "prerendered" ? "prerendered" : "live";
  cached = { mode, at: Date.now() };
  return mode;
}

export async function setRenderMode(mode: RenderMode, by: string): Promise<void> {
  await db.insert(systemEvents).values({ kind: "render_mode", detail: { mode, by } });
  cached = null;
}

export async function liveRendersUsed(userId: string, exec: Db | Tx = db): Promise<number> {
  const [{ n }] = await exec
    .select({ n: sql<number>`count(*)::int` })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        eq(generationJobs.vertical, "video"),
        sql`${generationJobs.providerState}->>'served' = 'live'`,
        inArray(generationJobs.status, ["queued", "processing", "succeeded"]),
      ),
    );
  return n;
}

export async function decideRender(userId: string, kind: "guest" | "registered", motion: PresetMotion["type"], exec: Db | Tx = db): Promise<RenderDecision> {
  if ((await getRenderMode()) === "prerendered") return { live: false, reason: "kill_switch" };
  if (PRERENDER_ONLY_MOTIONS.includes(motion)) return { live: false, reason: "expensive_preset" };
  if ((await liveRendersUsed(userId, exec)) >= LIVE_RENDER_CAP[kind]) return { live: false, reason: "render_cap" };
  return { live: true };
}

export async function renderPolicyFor(userId: string | null, kind: "guest" | "registered" | null) {
  const mode = await getRenderMode();
  const cap = LIVE_RENDER_CAP[kind ?? "guest"];
  const used = userId ? await liveRendersUsed(userId) : 0;
  return { mode, liveRendersLeft: mode === "prerendered" ? 0 : Math.max(0, cap - used), prerenderOnlyMotions: PRERENDER_ONLY_MOTIONS };
}

export const FALLBACK_COPY: Record<FallbackReason, string> = {
  kill_switch: "Live rendering is paused on this free-tier deployment to stay within its compute limit.",
  render_cap: "You've used your live render. This free-tier deployment caps live rendering to stay within its compute limit.",
  expensive_preset: "This move costs about twice the compute of the others, so on this free-tier deployment it's served pre-rendered.",
};
