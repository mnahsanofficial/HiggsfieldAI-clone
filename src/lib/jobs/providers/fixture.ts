import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { readMedia } from "@/lib/storage";
import type { ImageProvider } from "./types";

// Test double for the image provider, so UI tests never spend the free daily allowance that
// production shares. It returns a seed-library image instead of calling Cloudflare. It can only
// be switched on off Vercel (IMAGE_PROVIDER=fixture on a local `next start`), and jobs it runs
// are recorded with provider_key 'test-fixture'.
export const fixtureProvider: ImageProvider = {
  key: "test-fixture",
  async generate() {
    // Roughly the real provider's latency, so tests see runs in progress the way users do. At
    // 1.5 s a run could finish before the log's first poll, and the pending state never showed.
    await new Promise((r) => setTimeout(r, Number(process.env.FIXTURE_LATENCY_MS ?? 3000)));
    const [seed] = await db.select({ url: assets.url, width: assets.width, height: assets.height }).from(assets).where(and(eq(assets.collection, "seed"), eq(assets.topic, "product"))).orderBy(sql`random()`).limit(1);
    const media = await readMedia(seed.url.replace(/^\/media\//, ""));
    if (!media) throw new Error("fixture seed image missing");
    return { bytes: Buffer.from(await new Response(media.stream).arrayBuffer()), contentType: media.contentType, width: seed.width, height: seed.height };
  },
};

export const fixtureMode = () => process.env.IMAGE_PROVIDER === "fixture" && !process.env.VERCEL;
