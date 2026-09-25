import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import type { Tx } from "@/lib/credits/ledger";

// New accounts start with a few example images so the library isn't empty on first load
// (brief: "seed the demo account's library"). Examples are row copies of public seed
// rows: no upload, no charge. They are identifiable, and labelled "Example" in the
// UI, by: user-owned, source 'generated', and no job (a real generation always has a job).

// The seed collection's topics; the rows carry them, the file names don't decide them.
const TOPICS = ["cinema", "portrait", "street", "product", "fantasy", "nature"];

export async function addExampleAssets(tx: Tx, userId: string): Promise<number> {
  const picks = [];
  for (const topic of TOPICS) {
    const [seed] = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.collection, "seed"), eq(assets.topic, topic), eq(assets.isPublic, true)))
      .orderBy(sql`random()`)
      .limit(1);
    if (seed) picks.push(seed);
  }
  if (!picks.length) return 0;
  await tx.insert(assets).values(
    picks.map((s) => ({
      userId,
      jobId: null,
      kind: s.kind,
      source: "generated" as const,
      url: s.url,
      width: s.width,
      height: s.height,
      modelId: s.modelId,
      prompt: s.prompt,
      aspect: s.aspect,
      isPublic: false,
      // Oldest first, so the user's own generations always appear above the examples.
      createdAt: sql`now() - interval '1 day'`,
    })),
  );
  return picks.length;
}

export function isExampleAsset(a: { jobId: string | null; source: string; userId?: string | null }) {
  return a.jobId === null && a.source === "generated";
}

export async function randomSeedImage(topic: string) {
  const [seed] = await db
    .select({ url: assets.url, width: assets.width, height: assets.height, prompt: assets.prompt })
    .from(assets)
    .where(and(eq(assets.collection, "seed"), eq(assets.topic, topic), eq(assets.isPublic, true)))
    .orderBy(sql`random()`)
    .limit(1);
  return seed ?? null;
}
