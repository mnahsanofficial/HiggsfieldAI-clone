// Renders a short preview loop for every preset with the real camera renderer, over a seed
// still that suits the move, and links it as the preset's preview asset. The gallery shows
// genuine renderer output, not stock clips. Idempotent: presets that have a preview are skipped.
// run: npx tsx --conditions react-server scripts/seed-preset-previews.ts [--force]
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Which seed each preset previews over: wide scenes for pans/arcs, faces for push/focus.
const SOURCE: Record<string, string> = {
  general: "cinema-06",
  "slow-push-in": "portrait-10",
  "crash-zoom": "fantasy-01",
  "pull-out-reveal": "fantasy-06",
  "pan-left": "cinema-03",
  "pan-right": "cinema-11",
  "tilt-up": "street-02",
  "tilt-down": "nature-03",
  "arc-pan-left": "cinema-01",
  "arc-pan-right": "fantasy-08",
  handheld: "street-09",
  "handheld-push": "cinema-07",
  "rack-focus-in": "portrait-04",
  "rack-focus-out": "product-07",
};

async function main() {
  const force = process.argv.includes("--force");
  const { eq, like, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { assets, presets } = await import("../src/db/schema");
  const { renderCameraMove } = await import("../src/lib/render/camera");
  const { readMedia, uploadMedia } = await import("../src/lib/storage");

  const all = await db.select().from(presets).orderBy(presets.sort);
  for (const preset of all) {
    if (preset.previewAssetId && !force) {
      console.log(`skip ${preset.id}`);
      continue;
    }
    const slug = SOURCE[preset.id] ?? "cinema-06";
    const [seed] = await db.select().from(assets).where(like(assets.url, `/media/seed/${slug}-%`)).limit(1);
    if (!seed) throw new Error(`seed ${slug} missing`);
    const media = await readMedia(seed.url.replace(/^\/media\//, ""));
    const image = Buffer.from(await new Response(media!.stream).arrayBuffer());

    const out = await renderCameraMove({ image, motion: preset.motion, width: 640, height: 360, durationS: 4, deadlineMs: Date.now() + 120_000 });
    const [video, poster] = await Promise.all([
      uploadMedia(`renders/preset-${preset.id}.mp4`, out.mp4, "video/mp4"),
      uploadMedia(`renders/preset-${preset.id}-poster.jpg`, out.poster, "image/jpeg"),
    ]);
    const [row] = await db
      .insert(assets)
      .values({
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
        prompt: `${preset.name} preview: ${seed.prompt ?? ""}`,
        isPublic: true,
      })
      .returning({ id: assets.id });
    await db.update(presets).set({ previewAssetId: row.id }).where(eq(presets.id, preset.id));
    console.log(`ok   ${preset.id.padEnd(16)} ${(out.mp4.length / 1024).toFixed(0)}KB render ${out.renderMs}ms over ${slug}`);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(presets).where(sql`${presets.previewAssetId} IS NOT NULL`);
  console.log(`${n}/${all.length} presets have previews`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
