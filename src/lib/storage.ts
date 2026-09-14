import "server-only";
import { get, put } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BLOB_PUTS_MONTHLY_CAP, systemEvents } from "@/db/schema";

// The only module allowed to touch Vercel Blob (ESLint enforces this).
//
// Upload cap: Hobby includes 2,000 uploads a month and locks the store for 30 days past
// that. Before every put() we increment blob_usage for the current UTC month. The row has
// CHECK (puts BETWEEN 0 AND 1500), so the 1,501st reservation fails inside Postgres,
// whatever code path attempts it. The trip is logged once per month.
//
// Delivery: the project's store is private. Media is stored under a small set of
// prefixes and served by /media/[...path], which streams the blob with an immutable
// cache header, so Vercel's CDN absorbs repeat views. Assets store the app-relative URL.

export const MEDIA_PREFIXES = ["generations/", "renders/", "seed/"] as const;

export class StorageCapReachedError extends Error {
  constructor(readonly period: string) {
    super(`Monthly upload cap of ${BLOB_PUTS_MONTHLY_CAP} reached for ${period}`);
  }
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

// Locally, `vercel env pull` also writes VERCEL_OIDC_TOKEN and the SDK prefers OIDC, which
// this store only allows in Preview/Production. An explicit read-write token wins when
// present (local dev); on Vercel it's absent and OIDC + BLOB_STORE_ID are used.
function auth() {
  return process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {};
}

export async function reserveUpload(period = currentPeriod()): Promise<number> {
  try {
    const res = await db.execute<{ puts: number }>(sql`
      INSERT INTO blob_usage (period, puts) VALUES (${period}, 1)
      ON CONFLICT (period) DO UPDATE SET puts = blob_usage.puts + 1, updated_at = now()
      RETURNING puts`);
    return Number(res.rows[0].puts);
  } catch (err) {
    const e = err as { constraint?: string; cause?: { constraint?: string } };
    if ((e.constraint ?? e.cause?.constraint) === "blob_usage_puts_cap") {
      await db.execute(sql`
        INSERT INTO system_events (kind, detail)
        SELECT 'blob_cap_reached', ${JSON.stringify({ period, cap: BLOB_PUTS_MONTHLY_CAP })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM ${systemEvents} WHERE kind = 'blob_cap_reached' AND detail->>'period' = ${period}
        )`);
      console.error(`[storage] upload cap reached for ${period}; uploads refused until next month`);
      throw new StorageCapReachedError(period);
    }
    throw err;
  }
}

// Uploads media and returns the app-relative URL it is served from.
export async function uploadMedia(pathname: string, body: Buffer, contentType: string): Promise<{ url: string; pathname: string }> {
  if (!MEDIA_PREFIXES.some((p) => pathname.startsWith(p))) throw new Error(`pathname must start with ${MEDIA_PREFIXES.join(" | ")}`);
  // Reserve first. A put that then fails still counts, so the counter can only over-count
  // real uploads, which errs on the safe side of the cap.
  await reserveUpload();
  const blob = await put(pathname, body, { access: "private", contentType, addRandomSuffix: true, ...auth() });
  return { url: `/media/${blob.pathname}`, pathname: blob.pathname };
}

export async function readMedia(pathname: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; size: number } | null> {
  if (!MEDIA_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.includes("..")) return null;
  const res = await get(pathname, { access: "private", ...auth() });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size };
}
