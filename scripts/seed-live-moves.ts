// Publishes a few genuinely live camera-move runs to the public log, so the showcase isn't
// mostly pre-rendered examples. Each is a real run through the real pipeline: submitted by the
// library account (registered, can't be signed in to), charged the real price through the ledger,
// rendered live by ffmpeg over a library still ON THIS MACHINE (runVideoJob, not a Vercel
// Function), then published. The account is granted the credits it spends as a labelled
// adjustment, so every charge is real and reconciles. Idempotent; refuses to publish a run that
// wasn't rendered live.
// run: npx tsx --conditions react-server scripts/seed-live-moves.ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Moves with obvious motion, over library stills with clearly different subjects.
const MOVES: [presetId: string, stillId: string][] = [
  ["slow-push-in", "881333da-2d03-49f9-a60c-22c9b99d10d9"], // astronaut in a red desert
  ["pan-right", "850d5c02-1f56-4298-8090-1e5750117733"], // train on a snowy bridge
  ["crash-zoom", "529d6bec-0313-4e10-be74-c3ccb520b9a4"], // diner at 3am
];
const EMAIL = "library@docket.invalid";

async function main() {
  const { and, eq, isNotNull, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const video = await import("../src/lib/jobs/video");
  const ledger = await import("../src/lib/credits/ledger");
  const policy = await import("../src/lib/render/policy");
  const log = await import("../src/lib/log/entries");
  try {
    const [account] = await db.select({ id: S.users.id }).from(S.users).where(eq(S.users.email, EMAIL));
    if (!account) throw new Error("no library account: run scripts/seed-public-moves.ts first");
    if ((await policy.getRenderMode()) !== "live") throw new Error("render mode isn't live; these must be live renders");

    for (const [presetId, stillId] of MOVES) {
      const [done] = await db
        .select({ id: S.generationJobs.id })
        .from(S.generationJobs)
        .where(and(eq(S.generationJobs.userId, account.id), eq(S.generationJobs.presetId, presetId), isNotNull(S.generationJobs.publishedAt), sql`${S.generationJobs.providerState}->>'served' = 'live'`));
      if (done) {
        console.log(`skip ${presetId}: a live run is already published (${done.id})`);
        continue;
      }
      const [still] = await db.select({ aspect: S.assets.aspect }).from(S.assets).where(eq(S.assets.id, stillId));
      if (!still?.aspect) throw new Error(`no still ${stillId}`);

      // The price of one live move, granted first so the charge is real and the balance never goes below zero.
      const [move] = await db.select().from(S.models).where(eq(S.models.id, "camera_motion"));
      const { priceJob } = await import("../src/lib/credits/pricing");
      const cost = priceJob(move.pricing, { resolution: "720p", batchSize: 1, durationS: 5 }).costTenths;
      await db.transaction((tx) => ledger.grantCredits(tx, account.id, cost, "adjustment", `Library account: credits for a live example render (${presetId})`));

      const run = await video.submitVideoJob(account.id, { modelId: "camera_motion", presetId, inputAssetId: stillId, aspect: still.aspect, resolution: "720p", durationS: 5 });
      if (!run.live) throw new Error(`${presetId} wasn't served live (${run.reason}); not publishing a pre-rendered run as live`);
      console.log(`rendering ${presetId} ${still.aspect} live: ${run.jobId}, charged ${run.costTenths / 10}`);
      await video.runVideoJob(run.jobId);
      const [job] = await db.select({ status: S.generationJobs.status }).from(S.generationJobs).where(eq(S.generationJobs.id, run.jobId));
      if (job.status !== "succeeded") throw new Error(`${presetId} render ended ${job.status}`);
      await log.setPublished(account.id, run.jobId, true);
      console.log(`published ${presetId}: ${run.jobId}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
