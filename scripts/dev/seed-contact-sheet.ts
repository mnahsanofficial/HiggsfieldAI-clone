// QA for the seed library: reads every public seed back from private Blob, flags near-blank
// frames by pixel variance, and writes a labelled contact sheet for visual review.
// run: npx tsx --conditions react-server scripts/dev/seed-contact-sheet.ts <out.jpg>
import { loadEnvConfig } from "@next/env";
import sharp, { type OverlayOptions } from "sharp";

loadEnvConfig(process.cwd());

async function main() {
  const out = process.argv[2] ?? "seed-contact-sheet.jpg";
  const { sql } = await import("drizzle-orm");
  const { db, pool } = await import("../../src/db");
  const { assets } = await import("../../src/db/schema");
  const { readMedia } = await import("../../src/lib/storage");

  const seeds = await db
    .select({ id: assets.id, url: assets.url })
    .from(assets)
    .where(sql`${assets.url} LIKE '/media/seed/%' AND ${assets.userId} IS NULL`)
    .orderBy(assets.url);

  const TILE = 200;
  const COLS = 10;
  const tiles: OverlayOptions[] = [];
  const suspicious: string[] = [];
  for (const [i, s] of seeds.entries()) {
    const media = await readMedia(s.url.replace(/^\/media\//, ""));
    if (!media) {
      suspicious.push(`${s.url} (unreadable)`);
      continue;
    }
    const buf = Buffer.from(await new Response(media.stream).arrayBuffer());
    const stats = await sharp(buf).stats();
    const stdev = stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
    const slug = s.url.replace(/^\/media\/seed\//, "").replace(/-[A-Za-z0-9]{20,}\.jpg$/, "");
    if (stdev < 12) suspicious.push(`${slug} (stdev ${stdev.toFixed(1)})`);
    const label = Buffer.from(
      `<svg width="${TILE}" height="22"><rect width="100%" height="100%" fill="black" opacity="0.7"/><text x="6" y="16" font-size="13" font-family="Menlo" fill="${stdev < 12 ? "#ff5555" : "#d4ff3f"}">${slug} σ${stdev.toFixed(0)}</text></svg>`,
    );
    const tile = await sharp(buf)
      .resize(TILE, TILE, { fit: "cover" })
      .composite([{ input: label, gravity: "south" }])
      .toBuffer();
    tiles.push({ input: tile, left: (i % COLS) * TILE, top: Math.floor(i / COLS) * TILE });
  }
  const rows = Math.ceil(seeds.length / COLS);
  await sharp({ create: { width: COLS * TILE, height: rows * TILE, channels: 3, background: "#111" } })
    .composite(tiles)
    .jpeg({ quality: 80 })
    .toFile(out);
  console.log(`${seeds.length} seeds -> ${out}`);
  console.log(suspicious.length ? `suspicious: ${suspicious.join(", ")}` : "no near-blank frames");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
