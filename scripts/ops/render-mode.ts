// Kill switch for live video rendering. Takes effect on production within ~10s, no deploy.
// run: npx tsx --conditions react-server scripts/ops/render-mode.ts [live|prerendered]
// (no argument prints the current mode)
// Equivalent SQL: INSERT INTO system_events (kind, detail) VALUES ('render_mode', '{"mode":"prerendered","by":"sql"}');
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const arg = process.argv[2];
  const { pool } = await import("../../src/db");
  const policy = await import("../../src/lib/render/policy");
  if (arg === "live" || arg === "prerendered") {
    await policy.setRenderMode(arg, "ops-script");
    console.log(`render mode set to ${arg}`);
  } else if (arg) {
    console.error("usage: render-mode.ts [live|prerendered]");
    process.exit(1);
  }
  console.log(`current render mode: ${await policy.getRenderMode()}${process.env.VIDEO_RENDER_MODE === "prerendered" ? " (forced by VIDEO_RENDER_MODE env)" : ""}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
