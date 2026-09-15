import { and, eq, isNull, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets, presets } from "@/db/schema";
import { renderCameraMove } from "@/lib/render/camera";
import { readMedia } from "@/lib/storage";

// TEMPORARY spike for feat/video-render: proves a real ffmpeg render runs inside a Vercel
// Function before any preset UI is built on it. Disabled in production. Removed once the
// renderer is wired into jobs.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const presetId = url.searchParams.get("preset") ?? "slow-push-in";
  const res = url.searchParams.get("res") === "1080" ? { w: 1920, h: 1080 } : { w: 1280, h: 720 };
  const durationS = Number(url.searchParams.get("d") ?? 5);

  const invokedAt = Date.now();
  const [preset] = await db.select().from(presets).where(eq(presets.id, presetId));
  const [seed] = await db.select().from(assets).where(and(isNull(assets.userId), like(assets.url, "/media/seed/cinema-%"))).limit(1);
  const media = await readMedia(seed.url.replace(/^\/media\//, ""));
  const image = Buffer.from(await new Response(media!.stream).arrayBuffer());

  try {
    const out = await renderCameraMove({
      image,
      motion: preset.motion,
      width: res.w,
      height: res.h,
      durationS,
      deadlineMs: invokedAt + (maxDuration - 20) * 1000,
    });
    if (url.searchParams.get("download") === "1") {
      return new Response(new Uint8Array(out.mp4), { headers: { "Content-Type": "video/mp4" } });
    }
    return NextResponse.json({
      ok: true,
      preset: presetId,
      size: `${out.width}x${out.height}`,
      durationMs: out.durationMs,
      renderMs: out.renderMs,
      totalMs: Date.now() - invokedAt,
      mp4Bytes: out.mp4.length,
      mp4Magic: out.mp4.subarray(4, 8).toString("latin1"),
      region: process.env.VERCEL_REGION ?? "local",
      cpus: (await import("node:os")).cpus().length,
      limitEnv: Object.fromEntries(Object.entries(process.env).filter(([k]) => /DURATION|TIMEOUT|DEADLINE|MAX_?TIME|MEMORY/i.test(k)).map(([k, v]) => [k, v])),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), totalMs: Date.now() - invokedAt }, { status: 500 });
  }
}
