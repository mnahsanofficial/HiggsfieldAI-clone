// Pre-rendered fallback library: every preset in every aspect, rendered locally (not on Vercel) at
// the live settings (720p, 5s) with the production renderer. Served, labelled and free, when live
// rendering is capped, killed, or the preset is pre-render-only. Idempotent.
// run: npx tsx --conditions react-server scripts/seed-render-library.ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const STILLS: Record<string, { seed: string; width: number; height: number }> = {
  "16:9": { seed: "cinema-06", width: 1280, height: 720 },
  "9:16": { seed: "street-09", width: 720, height: 1280 },
  "1:1": { seed: "portrait-04", width: 720, height: 720 },
};

async function main() {
  const { and, isNull, like } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { assets, presets } = await import("../src/db/schema");
  const { renderCameraMove } = await import("../src/lib/render/camera");
  const { readMedia, uploadMedia } = await import("../src/lib/storage");

  const images = new Map<string, Buffer>();
  for (const [aspect, s] of Object.entries(STILLS)) {
    const [seed] = await db.select().from(assets).where(and(isNull(assets.userId), like(assets.url, `/media/seed/${s.seed}-%`))).limit(1);
    const media = await readMedia(seed.url.replace(/^\/media\//, ""));
    images.set(aspect, Buffer.from(await new Response(media!.stream).arrayBuffer()));
  }

  let made = 0;
  for (const preset of await db.select().from(presets).orderBy(presets.sort)) {
    for (const [aspect, s] of Object.entries(STILLS)) {
      const slug = `library-${preset.id}-${aspect.replace(":", "x")}`;
      const [exists] = await db.select({ id: assets.id }).from(assets).where(and(isNull(assets.userId), like(assets.url, `/media/renders/${slug}-%`))).limit(1);
      if (exists) continue;
      const out = await renderCameraMove({ image: images.get(aspect)!, motion: preset.motion, width: s.width, height: s.height, durationS: 5, deadlineMs: Date.now() + 120_000 });
      const video = await uploadMedia(`renders/${slug}.mp4`, out.mp4, "video/mp4");
      const poster = await uploadMedia(`renders/${slug}-poster.jpg`, out.poster, "image/jpeg");
      await db.insert(assets).values({
        userId: null,
        kind: "video",
        source: "rendered",
        url: video.url,
        posterUrl: poster.url,
        width: out.width,
        height: out.height,
        durationMs: out.durationMs,
        modelId: "camera_motion",
        presetId: preset.id,
        prompt: `${preset.name} (pre-rendered library, ${aspect})`,
        collection: "render_library",
        aspect,
        isPublic: false,
      });
      made++;
      console.log(`ok ${slug} ${(out.mp4.length / 1024).toFixed(0)}KB ${out.renderMs}ms`);
    }
  }
  console.log(`rendered ${made} new library clips`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
