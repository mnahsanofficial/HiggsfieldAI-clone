import "server-only";
import { eq, max } from "drizzle-orm";
import { db, type Db } from "@/db";
import { IMAGE_CALLS_PER_DAY, plans, users } from "@/db/schema";
import type { Tx } from "@/lib/credits/ledger";
import { LIVE_RENDER_CAP } from "@/lib/render/policy";

// Every limit a visitor meets, read from the values that enforce it. The image caps, the plan
// cards and the starter copy all come through here, so what a page says and what the server
// allows can't drift apart (scripts/verify-limits.ts checks both sides).
//  - images a day: the plan's `images_per_day` (a paid plan raises it), within the site's
//    IMAGE_CALLS_PER_DAY, which everyone shares
//  - per network: the highest plan cap, so someone alone on their network always gets their
//    plan's full cap, while cycling guest sessions still can't multiply the free one
//  - live camera moves: LIVE_RENDER_CAP per account, the same on every plan (it's server CPU,
//    which paying doesn't add); after that, moves are free pre-rendered examples

type Exec = Db | Tx;

export async function imagesPerDayFor(userId: string | null, exec: Exec = db): Promise<number> {
  if (userId) {
    const [row] = await exec.select({ n: plans.imagesPerDay }).from(users).innerJoin(plans, eq(plans.id, users.planId)).where(eq(users.id, userId));
    if (row) return row.n;
  }
  const [free] = await exec.select({ n: plans.imagesPerDay }).from(plans).where(eq(plans.id, "free"));
  return free?.n ?? 1;
}

export async function imagesPerNetworkPerDay(exec: Exec = db): Promise<number> {
  const [{ n }] = await exec.select({ n: max(plans.imagesPerDay) }).from(plans);
  return n ?? 1;
}

export const liveRendersFor = (kind: "guest" | "registered" | null) => LIVE_RENDER_CAP[kind ?? "guest"];

export type VisitorLimits = { imagesPerDay: number; liveRenders: number; siteImagesPerDay: number };

export async function limitsFor(user: { id: string; kind: "guest" | "registered" } | null): Promise<VisitorLimits> {
  return { imagesPerDay: await imagesPerDayFor(user?.id ?? null), liveRenders: liveRendersFor(user?.kind ?? null), siteImagesPerDay: IMAGE_CALLS_PER_DAY };
}
