import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { generationJobs, IMAGE_CALLS_PER_DAY, imageUsage } from "@/db/schema";
import type { Tx } from "@/lib/credits/ledger";
import { fixtureMode } from "./providers/fixture";

// The free image allowance, shared by everyone on this deployment, and how it's divided.
//  - site: IMAGE_CALLS_PER_DAY real provider calls a UTC day (see schema.ts for the arithmetic),
//    reserved in Postgres before each call.
//  - per visitor: 5 images a day per account, so no one uses up the day for everyone.
//  - per network: 20 a day per IP, so cycling guest sessions can't get around the per-visitor
//    cap, while a few reviewers behind one office IP can still each make theirs.
// All three are checked before anything is charged; the site counter's CHECK is the hard stop.
export const IMAGES_PER_VISITOR_PER_DAY = 5;
export const IMAGES_PER_NETWORK_PER_DAY = 20;

export class DailyLimitError extends Error {
  constructor(
    readonly scope: "site" | "visitor" | "network",
    message: string,
  ) {
    super(message);
  }
}

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const dayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function untilUtcMidnight(now = new Date()): string {
  const mins = Math.max(1, Math.ceil((dayStart(now).getTime() + 86_400_000 - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function hashIp(ip: string | null | undefined): string | null {
  return ip ? createHash("sha256").update(`${process.env.AUTH_SECRET}:${ip}`).digest("hex").slice(0, 32) : null;
}

export function clientIp(from: Request | Headers): string | null {
  const h = from instanceof Headers ? from : from.headers;
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

// Reserves one real provider call. Throws DailyLimitError once the day's allowance is gone.
export async function reserveImageCall(day = utcDay()): Promise<number> {
  try {
    const r = await db.execute<{ calls: number }>(sql`
      INSERT INTO image_usage (day, calls) VALUES (${day}, 1)
      ON CONFLICT (day) DO UPDATE SET calls = image_usage.calls + 1, updated_at = now()
      RETURNING calls`);
    return Number(r.rows[0].calls);
  } catch (err) {
    const e = err as { constraint?: string; cause?: { constraint?: string } };
    if ((e.constraint ?? e.cause?.constraint) === "image_usage_calls_cap") throw new DailyLimitError("site", siteMessage());
    throw err;
  }
}

// The provider said the allowance is gone before our count did: believe it, and show 0 left.
export async function markImagesExhausted(day = utcDay()): Promise<void> {
  await db.execute(sql`
    INSERT INTO image_usage (day, calls) VALUES (${day}, ${IMAGE_CALLS_PER_DAY})
    ON CONFLICT (day) DO UPDATE SET calls = ${IMAGE_CALLS_PER_DAY}, updated_at = now()`);
}

export const siteMessage = () => `The free daily image limit for this deployment has been used up. It resets at 00:00 UTC, in ${untilUtcMidnight()}.`;

export type ImageQuota = {
  siteCapacity: number;
  siteLeft: number;
  perVisitor: number;
  yoursLeft: number; // for this account and network, whichever is lower
  resetsIn: string;
  // Local test server with the fixture provider: nothing real is spent, so the site-wide figure
  // doesn't apply (the UI says so instead of showing a number).
  testMode: boolean;
};

// Images counted against a visitor: every image job submitted today that could have used the
// provider (failures from the provider itself used nothing and are left out).
async function imagesToday(exec: Db | Tx, where: ReturnType<typeof eq>) {
  const [{ n }] = await exec
    .select({ n: sql<number>`coalesce(sum((${generationJobs.params}->>'batchSize')::int), 0)::int` })
    .from(generationJobs)
    .where(
      and(
        where,
        eq(generationJobs.vertical, "image"),
        gte(generationJobs.createdAt, dayStart()),
        inArray(generationJobs.status, ["queued", "processing", "succeeded", "canceled"]),
      ),
    );
  return n;
}

export async function imageQuota(userId: string | null, ipHash: string | null, exec: Db | Tx = db): Promise<ImageQuota> {
  const [usage] = await exec.select({ calls: imageUsage.calls }).from(imageUsage).where(eq(imageUsage.day, utcDay()));
  const siteLeft = Math.max(0, IMAGE_CALLS_PER_DAY - (usage?.calls ?? 0));
  const mine = userId ? await imagesToday(exec, eq(generationJobs.userId, userId)) : 0;
  const network = ipHash ? await imagesToday(exec, eq(generationJobs.clientIpHash, ipHash)) : 0;
  const yoursLeft = Math.max(0, Math.min(IMAGES_PER_VISITOR_PER_DAY - mine, IMAGES_PER_NETWORK_PER_DAY - network));
  const testMode = fixtureMode();
  return { siteCapacity: IMAGE_CALLS_PER_DAY, siteLeft: testMode ? IMAGE_CALLS_PER_DAY : siteLeft, perVisitor: IMAGES_PER_VISITOR_PER_DAY, yoursLeft, resetsIn: untilUtcMidnight(), testMode };
}

// Checked inside the submit transaction, with the user row locked, before any charge.
export async function assertImageAllowance(tx: Tx, userId: string, ipHash: string | null, batchSize: number, opts: { site: boolean } = { site: true }): Promise<void> {
  const q = await imageQuota(userId, ipHash, tx);
  if (opts.site && q.siteLeft < batchSize) {
    throw new DailyLimitError("site", q.siteLeft === 0 ? `${siteMessage()} Nothing was charged.` : `Only ${q.siteLeft} free ${q.siteLeft === 1 ? "image is" : "images are"} left today on this deployment. Choose ${q.siteLeft} or fewer. Nothing was charged.`);
  }
  if (q.yoursLeft < batchSize) {
    const perNetwork = q.yoursLeft < IMAGES_PER_VISITOR_PER_DAY - (await imagesToday(tx, eq(generationJobs.userId, userId)));
    if (q.yoursLeft === 0) {
      throw new DailyLimitError(
        perNetwork ? "network" : "visitor",
        perNetwork
          ? `This network has made its ${IMAGES_PER_NETWORK_PER_DAY} free images for today. More at 00:00 UTC, in ${q.resetsIn}. Nothing was charged.`
          : `You've made your ${IMAGES_PER_VISITOR_PER_DAY} free images for today. More at 00:00 UTC, in ${q.resetsIn}. Each visitor gets ${IMAGES_PER_VISITOR_PER_DAY} a day, so no one uses up the day for everyone. Nothing was charged.`,
      );
    }
    throw new DailyLimitError("visitor", `You can make ${q.yoursLeft} more ${q.yoursLeft === 1 ? "image" : "images"} today. Choose ${q.yoursLeft} or fewer. Nothing was charged.`);
  }
}
