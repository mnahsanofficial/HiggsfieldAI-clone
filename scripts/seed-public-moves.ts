// Publishes a few camera-move runs to the public log, so moves appear there beside images.
// They're real runs through the real pipeline (submitVideoJob), made by a library account that
// can't be signed in to, using the pre-render-only moves (arcs and rack focus): each is served as
// a pre-rendered example over its library still, free, and labelled exactly as a user's would
// be. Nothing is rendered. Idempotent.
// run: npx tsx --conditions react-server scripts/seed-public-moves.ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const MOVES: [presetId: string, aspect: string][] = [
  ["arc-pan-left", "16:9"],
  ["rack-focus-in", "1:1"],
  ["arc-pan-right", "9:16"],
  ["rack-focus-out", "16:9"],
];
const EMAIL = "library@docket.invalid";

async function main() {
  const { and, eq, isNotNull } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const video = await import("../src/lib/jobs/video");
  const log = await import("../src/lib/log/entries");
  try {
    let [account] = await db.select({ id: S.users.id }).from(S.users).where(eq(S.users.email, EMAIL));
    if (!account) {
      // A placeholder hash no password can match: this account exists to own library runs.
      [account] = await db.insert(S.users).values({ kind: "registered", email: EMAIL, displayName: "Docket library", passwordHash: "scrypt$no-password-can-sign-in" }).returning({ id: S.users.id });
    }
    for (const [presetId, aspect] of MOVES) {
      const [done] = await db
        .select({ id: S.generationJobs.id })
        .from(S.generationJobs)
        .where(and(eq(S.generationJobs.userId, account.id), eq(S.generationJobs.presetId, presetId), isNotNull(S.generationJobs.publishedAt)));
      if (done) {
        console.log(`skip ${presetId}: already published`);
        continue;
      }
      const [clip] = await db
        .select({ still: S.assets.sourceAssetId })
        .from(S.assets)
        .where(and(eq(S.assets.collection, "render_library"), eq(S.assets.presetId, presetId), eq(S.assets.aspect, aspect)));
      if (!clip?.still) throw new Error(`no library clip with a still for ${presetId} ${aspect}`);
      const run = await video.submitVideoJob(account.id, { modelId: "camera_motion", presetId, inputAssetId: clip.still, aspect, resolution: "720p", durationS: 5 });
      if (run.live) throw new Error(`${presetId} would have rendered live; this script never renders`);
      await log.setPublished(account.id, run.jobId, true);
      console.log(`published ${presetId} ${aspect}: ${run.jobId} (${run.reason})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
