import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { assets, models, type PresetMotion, presets } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth/current-user";
import { STARTER_CREDITS_TENTHS } from "@/lib/credits/starter";
import { listMyLog, listPublicLog, type LogEntry } from "@/lib/log/entries";
import { renderPolicyFor } from "@/lib/render/policy";
import { type ImageQuota, imageQuota } from "@/lib/jobs/image-quota";

// Everything /make needs, read from Postgres in one pass: both models with their real prices
// and limits, every camera move with its real preview render, the stills you can animate,
// the render policy (live renders left, kill switch), and your log.

export type MakeModel = {
  id: string;
  name: string;
  aspects: string[];
  resolutions: string[];
  durations: number[];
  maxBatch: number;
  pricing: typeof models.$inferSelect.pricing;
};

export type MakeMove = {
  id: string;
  name: string;
  description: string;
  category: string;
  motionType: PresetMotion["type"];
  preview: { url: string; posterUrl: string | null; width: number; height: number } | null;
};

export type MakeStill = { id: string; url: string; width: number; height: number; prompt: string | null; mine: boolean };

export type MakeData = {
  signedIn: boolean;
  registered: boolean;
  balanceTenths: number;
  image: MakeModel;
  video: MakeModel;
  moves: MakeMove[];
  stills: MakeStill[];
  policy: Awaited<ReturnType<typeof renderPolicyFor>>;
  quota: ImageQuota;
  entries: LogEntry[];
  publicEntries: LogEntry[];
};

const toModel = (m: typeof models.$inferSelect): MakeModel => ({
  id: m.id,
  name: m.name,
  aspects: m.capabilities.aspects,
  resolutions: m.capabilities.resolutions,
  durations: m.capabilities.durations ?? [],
  maxBatch: m.capabilities.maxBatch ?? 1,
  pricing: m.pricing,
});

export async function getMakeData(user: CurrentUser | null, ipHash: string | null): Promise<MakeData> {
  const preview = alias(assets, "preview");
  const [modelRows, moveRows, seedRows, mineRows, entries, policy, quota] = await Promise.all([
    db.select().from(models).where(and(eq(models.active, true), inArray(models.vertical, ["image", "video"]))).orderBy(asc(models.sort)),
    db
      .select({ p: presets, url: preview.url, posterUrl: preview.posterUrl, width: preview.width, height: preview.height })
      .from(presets)
      .leftJoin(preview, eq(preview.id, presets.previewAssetId))
      .orderBy(asc(presets.sort)),
    db
      .select({ id: assets.id, url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt })
      .from(assets)
      .where(and(eq(assets.collection, "seed"), eq(assets.isPublic, true), isNull(assets.deletedAt)))
      .orderBy(asc(assets.topic), asc(assets.createdAt)),
    user
      ? db
          .select({ id: assets.id, url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt })
          .from(assets)
          // Only images with a run behind them: example copies from signup aren't "yours".
          .where(and(eq(assets.userId, user.id), eq(assets.kind, "image"), eq(assets.source, "generated"), isNotNull(assets.jobId), isNull(assets.deletedAt)))
          .orderBy(desc(assets.createdAt))
          .limit(80)
      : Promise.resolve([]),
    user ? listMyLog(user.id, { limit: 20 }) : Promise.resolve([]),
    renderPolicyFor(user?.id ?? null, user?.kind ?? null),
    imageQuota(user?.id ?? null, ipHash),
  ]);

  const image = modelRows.find((m) => m.vertical === "image");
  const video = modelRows.find((m) => m.vertical === "video");
  if (!image || !video) throw new Error("No active image or video model in the catalogue");

  return {
    signedIn: !!user,
    registered: user?.kind === "registered",
    balanceTenths: user?.creditBalanceTenths ?? STARTER_CREDITS_TENTHS,
    image: toModel(image),
    video: toModel(video),
    moves: moveRows.map(({ p, url, posterUrl, width, height }) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      motionType: p.motion.type,
      preview: url && width && height ? { url, posterUrl, width, height } : null,
    })),
    stills: [...mineRows.map((s) => ({ ...s, mine: true })), ...seedRows.map((s) => ({ ...s, mine: false }))],
    policy,
    quota,
    entries,
    // A new visitor's log is empty, so the page shows the public log beneath the invitation.
    publicEntries: entries.length ? [] : await listPublicLog(user?.id ?? null, { limit: 6 }),
  };
}
