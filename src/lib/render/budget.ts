import type { PresetMotion } from "@/db/schema";

// Time budget for rendering inside a Vercel Function.
//
// The routes that run renders declare `export const maxDuration = 300` (the Hobby maximum with
// fluid compute). Route segment config must be a literal, so this constant mirrors it and
// scripts/verify-video.ts fails if the two ever disagree. If the platform exposes its own
// limit at runtime, the smaller value wins, so a config change that lowers the limit makes
// renders fail fast with a refund instead of being killed mid-render and left processing.
export const RENDER_FUNCTION_MAX_DURATION_S = 300;
const SAFETY_MARGIN_S = 25; // upload, DB writes and response after the render itself

export function functionLimitS(): number {
  const fromPlatform = Number(process.env.VERCEL_FUNCTION_MAX_DURATION ?? process.env.FUNCTION_MAX_DURATION ?? NaN);
  return Number.isFinite(fromPlatform) && fromPlatform > 0 ? Math.min(fromPlatform, RENDER_FUNCTION_MAX_DURATION_S) : RENDER_FUNCTION_MAX_DURATION_S;
}

export function renderDeadline(invokedAtMs: number): number {
  return invokedAtMs + (functionLimitS() - SAFETY_MARGIN_S) * 1000;
}

// Calibrated on the production function hardware (iad1, 2 vCPU): 5s at 720p push 4.1s, arc
// 6.0s; 5s at 1080p push 8.1s; 10s at 1080p handheld 16.1s. Roughly 900 ms per megapixel-second
// of output; arcs and rack focus cost more. Deliberately pessimistic (x1.6).
const MS_PER_MP_SECOND = 900 * 1.6;
const MOTION_FACTOR: Record<PresetMotion["type"], number> = { push: 1, pull: 1, pan: 1, tilt: 1, handheld: 1, arc: 1.5, rack_focus: 1.6 };

export function estimateRenderMs(motion: PresetMotion["type"], width: number, height: number, durationS: number): number {
  const mpSeconds = ((width * height) / 1e6) * durationS;
  return 2500 + mpSeconds * MS_PER_MP_SECOND * MOTION_FACTOR[motion];
}

export const RESOLUTION_DIMS: Record<string, Record<string, { width: number; height: number }>> = {
  "720p": { "16:9": { width: 1280, height: 720 }, "9:16": { width: 720, height: 1280 }, "1:1": { width: 720, height: 720 } },
  "1080p": { "16:9": { width: 1920, height: 1080 }, "9:16": { width: 1080, height: 1920 }, "1:1": { width: 1080, height: 1080 } },
};
