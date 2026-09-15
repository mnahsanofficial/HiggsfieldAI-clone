// Measures ffmpeg CPU-seconds (user+sys) per preset for a 720p 5s render, the settings live
// renders are now limited to. Runs locally with the same filter graphs the Vercel Function uses.
// run: npx tsx --conditions react-server scripts/dev/measure-render-cpu.ts [--upscale 1|2]
import { loadEnvConfig } from "@next/env";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

loadEnvConfig(process.cwd());

async function main() {
  const { like } = await import("drizzle-orm");
  const sharp = (await import("sharp")).default;
  const ffmpeg = (await import("@ffmpeg-installer/ffmpeg")).default;
  const { db, pool } = await import("../../src/db");
  const { assets, presets } = await import("../../src/db/schema");
  const { buildFilter } = await import("../../src/lib/render/camera");
  const { readMedia } = await import("../../src/lib/storage");

  const [seed] = await db.select().from(assets).where(like(assets.url, "/media/seed/cinema-06-%")).limit(1);
  const media = await readMedia(seed.url.replace(/^\/media\//, ""));
  const image = Buffer.from(await new Response(media!.stream).arrayBuffer());
  const W = 1280, H = 720, fps = 24, dur = 5, frames = dur * fps;
  const dir = mkdtempSync(join(tmpdir(), "cpu-"));
  const inPath = join(dir, "in.jpg");
  writeFileSync(inPath, await sharp(image).resize(W * 2, H * 2, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer());

  const rows: [string, number, number][] = [];
  for (const p of await db.select().from(presets).orderBy(presets.sort)) {
    const filter = buildFilter(p.motion, W, H, frames, fps, dur);
    const args = ["-p", ffmpeg.path, "-hide_banner", "-loglevel", "error", "-i", inPath, "-filter_complex", filter, "-frames:v", String(frames), "-r", String(fps), "-c:v", "libx264", "-preset", process.env.X264_PRESET ?? "superfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", join(dir, "out.mp4")];
    const t = Date.now();
    let out = "";
    try {
      execFileSync("/usr/bin/time", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      out = String((e as { stderr?: Buffer }).stderr ?? "");
    }
    // /usr/bin/time -p writes to stderr even on success; capture via a second run that always throws is awkward,
    // so run again capturing stderr explicitly.
    const res = execFileSync("/bin/sh", ["-c", `/usr/bin/time -p ${JSON.stringify(ffmpeg.path)} ${args.slice(2).map((a) => JSON.stringify(a)).join(" ")} 2>&1 >/dev/null | tail -3`]).toString() || out;
    const user = Number(/user\s+([\d.]+)/.exec(res)?.[1] ?? NaN);
    const sys = Number(/sys\s+([\d.]+)/.exec(res)?.[1] ?? NaN);
    rows.push([p.id, +(user + sys).toFixed(2), Date.now() - t]);
  }
  console.log("preset            cpu_s(local)  wall_ms(2 runs)");
  for (const [id, cpu, wall] of rows) console.log(`${id.padEnd(18)}${String(cpu).padStart(8)}  ${String(wall).padStart(10)}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
