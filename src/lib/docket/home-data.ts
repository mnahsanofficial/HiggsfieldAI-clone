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
  // One real published camera-move run, shown as the three steps: its still, its move, its receipt.
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
  const [[image], [move], moveCount, publicEntries, quota, pair] = await Promise.all([
    db.select().from(models).where(and(eq(models.id, "flux_1_schnell"), eq(models.active, true))),
    db.select().from(models).where(and(eq(models.id, "camera_motion"), eq(models.active, true))),
    db.$count(presets),
    listPublicLog(user?.id ?? null, { limit: 12 }),
    imageQuota(user?.id ?? null, ipHash),
    homePair(),
  ]);
  const moves = publicEntries.filter((e) => e.type === "run" && e.vertical === "video" && e.renderedFrom && e.assets.some((a) => a.kind === "video"));
  const example = moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  const resolution = move.capabilities.resolutions[0];
  const seconds = move.capabilities.durations?.[0] ?? 5;
  return {
    pair,
    example,
    strip: publicEntries.filter((e) => e.id !== example?.id).slice(0, 4),
    moveCount,
    image: { name: image.name, provider: PROVIDER[image.providerKey] ?? image.providerKey, costTenths: priceJob(image.pricing, { resolution: image.capabilities.resolutions[0], batchSize: 1 }).costTenths },
    move: { name: move.name, costTenths: priceJob(move.pricing, { resolution, batchSize: 1, durationS: seconds }).costTenths, seconds, resolution },
    starterTenths: STARTER_CREDITS_TENTHS,
    quota,
    liveRenders: liveRendersFor(user?.kind ?? null),
  };
}
