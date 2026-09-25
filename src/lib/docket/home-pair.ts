import "server-only";
import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { assets, presets } from "@/db/schema";
import { PRERENDER_ONLY_MOTIONS } from "@/lib/render/policy";

export type HomePair = {
  presetName: string;
  still: { url: string; prompt: string | null };
  take: { url: string; posterUrl: string | null; width: number; height: number };
};

// The product in one picture for home: a real camera move and the still it was rendered over,
// both from the database. One of the featured moves that render live (so it shows what your own
// render does), picked at random per visit.
export async function homePair(): Promise<HomePair | null> {
  const take = alias(assets, "take");
  const still = alias(assets, "still");
  const [row] = await db
    .select({ name: presets.name, takeUrl: take.url, poster: take.posterUrl, width: take.width, height: take.height, stillUrl: still.url, stillPrompt: still.prompt })
    .from(presets)
    .innerJoin(take, eq(take.id, presets.previewAssetId))
    .innerJoin(still, eq(still.id, take.sourceAssetId))
    .where(and(eq(presets.featured, true), isNotNull(take.sourceAssetId), notInArray(sql`${presets.motion}->>'type'`, PRERENDER_ONLY_MOTIONS)))
    .orderBy(sql`random()`)
    .limit(1);
  if (!row) return null;
  return { presetName: row.name, still: { url: row.stillUrl, prompt: row.stillPrompt }, take: { url: row.takeUrl, posterUrl: row.poster, width: row.width, height: row.height } };
}
