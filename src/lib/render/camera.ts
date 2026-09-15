import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";
import type { PresetMotion } from "@/db/schema";

// Renders a real camera move over a still image with ffmpeg: a genuine transform of a real
// input producing a real H.264 MP4. There is no diffusion step; the UI says so.
//
// Smoothness: zoompan positions are whole pixels, so the still is prepared at 2x the output
// size and upscaled 2x again inside ffmpeg (4x total). That keeps sub-pixel motion smooth
// and happens once per render, not per frame (zoompan emits every frame from one input).

export class RenderBudgetError extends Error {
  constructor(
    readonly projectedMs: number,
    readonly budgetMs: number,
  ) {
    super(`Render would take ~${Math.round(projectedMs / 1000)}s but only ${Math.round(budgetMs / 1000)}s remain`);
  }
}

export type RenderInput = {
  image: Buffer;
  motion: PresetMotion;
  width: number;
  height: number;
  durationS: number;
  fps?: number;
  // Absolute epoch ms by which the render must be finished (function deadline minus margin).
  deadlineMs: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export type RenderOutput = { mp4: Buffer; poster: Buffer; width: number; height: number; durationMs: number; renderMs: number };

const num = (v: number | string | undefined, fallback: number) => (typeof v === "number" ? v : v !== undefined && !Number.isNaN(Number(v)) ? Number(v) : fallback);

// ffmpeg expression for eased progress 0..1 over output frame index `on`.
function eased(frames: number, easing: string) {
  const p = `(on/${Math.max(frames - 1, 1)})`;
  if (easing === "in") return `(${p}*${p})`;
  if (easing === "out") return `(1-(1-${p})*(1-${p}))`;
  return `(${p}*${p}*(3-2*${p}))`; // smoothstep in-out
}

export function buildFilter(motion: PresetMotion, W: number, H: number, frames: number, fps: number, durationS: number): string {
  const P = motion.params;
  const e = eased(frames, String(P.easing ?? "inOut"));
  const centerX = "iw/2-(iw/zoom/2)";
  const centerY = "ih/2-(ih/zoom/2)";
  const zp = (z: string, x: string, y: string) => `scale=iw*2:ih*2,zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${fps}`;
  const finish = "format=yuv420p";

  switch (motion.type) {
    case "push": {
      const to = num(P.zoomTo, 1.2);
      return `${zp(`1+${to - 1}*${e}`, centerX, centerY)},${finish}`;
    }
    case "pull": {
      const from = num(P.zoomFrom, 1.35);
      return `${zp(`${from}-${from - 1}*${e}`, centerX, centerY)},${finish}`;
    }
    case "pan":
    case "tilt": {
      const travel = num(P.travel, 0.18);
      const z = 1 / (1 - travel); // just enough zoom to have `travel` of the frame to move across
      const dir = String(P.direction);
      const forward = dir === "right" || dir === "down";
      const pos = forward ? e : `(1-${e})`;
      const x = motion.type === "pan" ? `(iw-iw/zoom)*${pos}` : centerX;
      const y = motion.type === "tilt" ? `(ih-ih/zoom)*${pos}` : centerY;
      return `${zp(String(z), x, y)},${finish}`;
    }
    case "arc": {
      // A 2D arc: lateral travel plus a slow roll. Not a true orbit (no depth), and labelled so.
      const travel = num(P.travel, 0.16);
      const roll = (num(P.rollDeg, 3) * Math.PI) / 180;
      const z = 1 / (1 - travel);
      const pos = String(P.direction) === "right" ? e : `(1-${e})`;
      const rollExpr = `${roll.toFixed(4)}*sin(PI*t/${durationS})*${String(P.direction) === "right" ? 1 : -1}`;
      // Rotating a W×H frame exposes its corners, so zoompan renders ~10% oversize and the
      // rotate crops back to W×H. cosθ + (16/9)·sinθ ≈ 1.09 at θ=3°, so 1.1 covers 16:9.
      const OW = Math.ceil((W * 1.1) / 2) * 2;
      const OH = Math.ceil((H * 1.1) / 2) * 2;
      const arcPan = `scale=iw*2:ih*2,zoompan=z='${z}':x='(iw-iw/zoom)*${pos}':y='${centerY}':d=${frames}:s=${OW}x${OH}:fps=${fps}`;
      return `${arcPan},rotate='${rollExpr}':ow=${W}:oh=${H}:c=black,${finish}`;
    }
    case "handheld": {
      const k = num(P.intensity, 0.5);
      const zoomTo = num(P.zoomTo, 1);
      const base = 1.08 + 0.04 * k;
      const z = zoomTo > 1 ? `${base}+${zoomTo - 1}*${e}` : String(base);
      // Summed incommensurate sines: an organic, non-repeating drift within the zoom headroom.
      const ampX = `(iw-iw/zoom)/2*${(0.55 * k).toFixed(3)}`;
      const ampY = `(ih-ih/zoom)/2*${(0.45 * k).toFixed(3)}`;
      const x = `${centerX}+${ampX}*(0.6*sin(on*0.31)+0.4*sin(on*0.093+1.7))`;
      const y = `${centerY}+${ampY}*(0.6*sin(on*0.27+0.6)+0.4*sin(on*0.121+2.3))`;
      return `${zp(z, x, y)},${finish}`;
    }
    case "rack_focus": {
      // A blurred copy (blurred at quarter size, which looks the same for a heavy defocus and is
      // far cheaper) is laid over the sharp frame and its alpha faded over the first 80%.
      // fade+overlay are cheap built-ins; a per-pixel blend expression was ~4x slower on Vercel.
      const toSharp = String(P.to ?? "sharp") === "sharp";
      const pull = (durationS * 0.8).toFixed(2);
      const fade = toSharp ? `fade=t=out:st=0:d=${pull}:alpha=1` : `fade=t=in:st=0:d=${pull}:alpha=1`;
      return `${zp(`1+0.06*${e}`, centerX, centerY)},split[s][b];[b]scale=iw/4:ih/4,boxblur=luma_radius=5:luma_power=2,scale=${W}:${H},format=yuva420p,${fade}[bl];[s][bl]overlay=format=auto,${finish}`;
    }
  }
}

export async function renderCameraMove(input: RenderInput): Promise<RenderOutput> {
  const fps = input.fps ?? 24;
  const frames = Math.round(input.durationS * fps);
  const { width: W, height: H } = input;
  const started = Date.now();
  if (started >= input.deadlineMs) throw new RenderBudgetError(0, 0);

  const dir = join(tmpdir(), `render-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const inPath = join(dir, "in.jpg");
  const outPath = join(dir, "out.mp4");

  try {
    // Cover-crop the still to the output aspect at 2x size (zoompan headroom).
    const prepared = await sharp(input.image).resize(W * 2, H * 2, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
    await writeFile(inPath, prepared);
    const poster = await sharp(prepared).resize(W, H).jpeg({ quality: 82 }).toBuffer();

    const filter = buildFilter(input.motion, W, H, frames, fps, input.durationS);
    const args = [
      "-hide_banner", "-loglevel", "error", "-nostats",
      "-i", inPath,
      "-filter_complex", filter,
      "-frames:v", String(frames),
      "-r", String(fps),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-progress", "pipe:1",
      "-y", outPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegInstaller.path, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        proc.kill("SIGKILL");
        reject(err);
      };
      input.signal?.addEventListener("abort", () => fail(new Error("render aborted")));

      proc.stdout.on("data", (chunk: Buffer) => {
        const m = /frame=(\d+)/g;
        let match: RegExpExecArray | null;
        let frame = 0;
        while ((match = m.exec(chunk.toString()))) frame = Number(match[1]);
        if (!frame) return;
        const fraction = Math.min(frame / frames, 1);
        input.onProgress?.(fraction);
        // Runtime budget check: project the finish time from measured speed. Abort early and
        // cleanly rather than be killed mid-render by the platform.
        const elapsed = Date.now() - started;
        if (fraction >= 0.1) {
          const projectedTotal = elapsed / fraction;
          if (started + projectedTotal > input.deadlineMs) fail(new RenderBudgetError(projectedTotal, input.deadlineMs - started));
        }
      });
      proc.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
      proc.on("error", fail);
      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
      });
    });

    const mp4 = await readFile(outPath);
    return { mp4, poster, width: W, height: H, durationMs: Math.round((frames / fps) * 1000), renderMs: Date.now() - started };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
