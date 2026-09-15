// Video pipeline checks against the configured database and Blob, rendering with the local ffmpeg
// (run: npx tsx --conditions react-server scripts/verify-video.ts). Uses 2 uploads; cleans up.
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";

loadEnvConfig(process.cwd());

async function main() {
  const { and, eq, inArray, isNull, like, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const video = await import("../src/lib/jobs/video");
  const jobs = await import("../src/lib/jobs/service");
  const budget = await import("../src/lib/render/budget");
  const storage = await import("../src/lib/storage");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const newUser = async (tenths = 5000) => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx.insert(S.users).values({ kind: "guest", displayName: "video-test" }).returning({ id: S.users.id });
      await ledger.grantCredits(tx, u.id, tenths, "adjustment", "verify-video");
      return u.id;
    });
    users.push(id);
    return id;
  };
  const job = async (id: string) => (await db.select().from(S.generationJobs).where(eq(S.generationJobs.id, id)))[0];
  const balance = async (uid: string) => (await db.select({ b: S.users.creditBalanceTenths }).from(S.users).where(eq(S.users.id, uid)))[0].b;

  try {
    // Every route that runs renders must declare maxDuration equal to the budget constant.
    for (const file of ["src/app/api/jobs/route.ts", "src/app/api/jobs/[id]/retry/route.ts"]) {
      const m = /export const maxDuration = (\d+);/.exec(readFileSync(file, "utf8"));
      check(`${file} maxDuration == RENDER_FUNCTION_MAX_DURATION_S`, Number(m?.[1]) === budget.RENDER_FUNCTION_MAX_DURATION_S, `route ${m?.[1]}, constant ${budget.RENDER_FUNCTION_MAX_DURATION_S}`);
    }

    const [seed] = await db.select().from(S.assets).where(and(isNull(S.assets.userId), eq(S.assets.isPublic, true), like(S.assets.url, "/media/seed/cinema-%"))).limit(1);
    const u = await newUser();

    // 1. Real render: public seed image + preset -> 5s 720p MP4, charged 30 credits.
    const a = await video.submitVideoJob(u, { modelId: "camera_motion", presetId: "slow-push-in", inputAssetId: seed.id, aspect: "16:9", resolution: "720p", durationS: 5 });
    check("submit charges 30 credits (5s 720p)", a.costTenths === 300 && (await balance(u)) === 4700);
    const t0 = Date.now();
    await video.runVideoJob(a.jobId);
    const ja = await job(a.jobId);
    const [asset] = await db.select().from(S.assets).where(eq(S.assets.jobId, a.jobId));
    check("video job succeeded", ja.status === "succeeded", `${ja.status} ${ja.errorCode ?? ""} ${ja.errorMessage ?? ""} in ${Date.now() - t0}ms`);
    check("asset is a rendered 1280x720 5s video with poster", asset?.kind === "video" && asset.source === "rendered" && asset.width === 1280 && asset.height === 720 && asset.durationMs === 5000 && !!asset.posterUrl);
    if (asset) {
      const m = await storage.readMedia(asset.url.replace(/^\/media\//, ""));
      const buf = m ? Buffer.from(await new Response(m.stream).arrayBuffer()) : Buffer.alloc(0);
      check("MP4 stored in private Blob (ftyp header)", buf.subarray(4, 8).toString("latin1") === "ftyp" && m?.contentType === "video/mp4", `${buf.length} bytes`);
    }

    // 2. Budget assertion: invocation that started 290s ago can't fit any render -> fail + refund.
    const before = await balance(u);
    const b = await video.submitVideoJob(u, { modelId: "camera_motion", presetId: "rack-focus-in", inputAssetId: seed.id, aspect: "16:9", resolution: "1080p", durationS: 10 });
    await video.runVideoJob(b.jobId, Date.now() - 290_000);
    const jb = await job(b.jobId);
    check("over-budget render fails fast with render_budget and refunds", jb.status === "failed" && jb.errorCode === "render_budget" && (await balance(u)) === before, jb.errorMessage ?? "");
    const [{ stuck }] = await db.select({ stuck: sql<number>`count(*)::int` }).from(S.generationJobs).where(and(eq(S.generationJobs.userId, u), inArray(S.generationJobs.status, ["queued", "processing"])));
    check("no job left in processing", stuck === 0);

    // 3. Estimator is pessimistic relative to measured Vercel timings.
    const est = budget.estimateRenderMs("push", 1280, 720, 5);
    check("estimate for 5s 720p push >= measured 4.1s on Vercel", est >= 4100, `${Math.round(est)}ms`);
    check("worst case (10s 1080p rack focus) fits the 300s budget", budget.estimateRenderMs("rack_focus", 1920, 1080, 10) < (300 - 25) * 1000);

    // 4. Input ownership: another user's private image is refused.
    const other = await newUser();
    const [otherImg] = await db.insert(S.assets).values({ userId: other, kind: "image", source: "generated", url: seed.url, width: 1024, height: 576 }).returning({ id: S.assets.id });
    let refused = false;
    try {
      await video.submitVideoJob(u, { modelId: "camera_motion", presetId: "handheld", inputAssetId: otherImg.id, aspect: "16:9", resolution: "720p", durationS: 5 });
    } catch (e) {
      refused = e instanceof jobs.JobInputError;
    }
    check("another user's private image can't be animated", refused);

    // 5. Validation.
    let bad = 0;
    for (const patch of [{ durationS: 7 }, { resolution: "4k" }, { presetId: "nope" }, { aspect: "4:3" }]) {
      try {
        await video.submitVideoJob(u, { modelId: "camera_motion", presetId: "handheld", inputAssetId: seed.id, aspect: "16:9", resolution: "720p", durationS: 5, ...patch });
      } catch (e) {
        if (e instanceof jobs.JobInputError) bad++;
      }
    }
    check("invalid duration/resolution/preset/aspect rejected", bad === 4);

    // 6. Retry of a video job re-submits a video job.
    const r = await jobs.retryJob(u, b.jobId);
    check("retry of a failed video job creates a linked video job", r.vertical === "video" && (await job(r.jobId)).retryOfJobId === b.jobId);
    await jobs.cancelJob(u, r.jobId);

    const [{ sum }] = await db.select({ sum: sql<number>`coalesce(sum(delta_tenths),0)::int` }).from(S.creditLedger).where(eq(S.creditLedger.userId, u));
    check("ledger sum == balance", sum === (await balance(u)));
  } finally {
    if (users.length) await db.delete(S.users).where(inArray(S.users.id, users));
    console.log(`cleanup: removed ${users.length} test users`);
    await pool.end();
  }
  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
