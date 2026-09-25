import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { models, presets } from "@/db/schema";
import { liveRendersFor } from "@/lib/billing/limits";
import { priceJob } from "@/lib/credits/pricing";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { type ImageQuota, imageQuota } from "@/lib/jobs/image-quota";
import { listPublicLog, type LogEntry } from "@/lib/log/entries";
import { type HomePair, homePair } from "./home-pair";

// Where a provider key runs, in words. The key itself is the models row.
const PROVIDER: Record<string, string> = { cloudflare: "Cloudflare Workers AI" };

export type HomeData = {
  pair: HomePair | null;
  // One real published camera-move run, rendered live and charged, shown as the three steps.
  example: LogEntry | null;
  // A few more public entries, for the strip at the bottom.
  strip: LogEntry[];
  moveCount: number;
  image: { name: string; provider: string; costTenths: number };
  move: { name: string; costTenths: number; seconds: number; resolution: string };
  starterTenths: number;
  quota: ImageQuota;
  liveRenders: number;
};

// Everything home says, read from the database and the values the server enforces, so no
// number on the page is typed into it.
export async function homeData(user: { id: string; kind: "guest" | "registered" } | null, ipHash: string | null): Promise<HomeData> {
  const [[image], [move], movePresets, publicEntries, quota, pair] = await Promise.all([
    db.select().from(models).where(and(eq(models.id, "flux_1_schnell"), eq(models.active, true))),
    db.select().from(models).where(and(eq(models.id, "camera_motion"), eq(models.active, true))),
    db.select({ id: presets.id, motion: presets.motion }).from(presets),
    listPublicLog(user?.id ?? null, { limit: 12 }),
    imageQuota(user?.id ?? null, ipHash),
    homePair(),
  ]);
  // The example is a run rendered live and really charged, with a move you can see at a glance
  // (a push, pull, pan or tilt), never a pre-rendered stand-in.
  const obvious = new Set(movePresets.filter((p) => ["push", "pull", "pan", "tilt"].includes(p.motion.type)).map((p) => p.id));
  const live = publicEntries.filter((e) => e.type === "run" && e.vertical === "video" && e.servedAs === "live" && e.settlement === "charged" && e.renderedFrom && e.assets.some((a) => a.kind === "video"));
  const candidates = live.filter((e) => e.presetId && obvious.has(e.presetId));
  const example = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  // The strip shows real output: the other live runs, then library images. Pre-rendered
  // examples stay in the public log, labelled, but don't stand in for the product here.
  // A library image that a run shown here was rendered over would appear twice, so it's skipped.
  const runs = live.filter((e) => e.id !== example?.id);
  const shownStills = new Set([example, ...runs].map((e) => e?.renderedFrom?.id).filter(Boolean));
  const strip = [...runs, ...publicEntries.filter((e) => e.type === "library" && !shownStills.has(e.id))].slice(0, 4);
  const resolution = move.capabilities.resolutions[0];
  const seconds = move.capabilities.durations?.[0] ?? 5;
  return {
    pair,
    example,
    strip,
    moveCount: movePresets.length,
    image: { name: image.name, provider: PROVIDER[image.providerKey] ?? image.providerKey, costTenths: priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths },
    move: { name: move.name, costTenths: priceJob(move.pricing, { resolution, batchSize: 1, durationS: seconds }).costTenths, seconds, resolution },
    starterTenths: STARTER_CREDITS_TENTHS,
    quota,
    liveRenders: liveRendersFor(user?.kind ?? null),
  };
}
