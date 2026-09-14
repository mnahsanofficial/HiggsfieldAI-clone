// Job pipeline checks against the configured database, the real Cloudflare provider and
// real Vercel Blob (run: npx tsx --conditions react-server scripts/verify-jobs.ts).
// Uses ~1 real generation and 1 upload. Deletes its test users, jobs and events afterwards.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { and, eq, inArray, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const ledger = await import("../src/lib/credits/ledger");
  const jobs = await import("../src/lib/jobs/service");
  const storage = await import("../src/lib/storage");
  const { ProviderError } = await import("../src/lib/jobs/providers/types");

  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const users: string[] = [];
  const cacheKeys: string[] = [];
  const stamp = Date.now();
  const prompt = `verify-jobs ${stamp}: a lime green vintage car parked on a rainy neon street at night, cinematic`;

  const newUser = async (tenths = 1000) => {
    const id = await db.transaction(async (tx) => {
      const [u] = await tx.insert(S.users).values({ kind: "guest", displayName: "jobs-test" }).returning({ id: S.users.id });
      await ledger.grantCredits(tx, u.id, tenths, "adjustment", "verify-jobs");
      return u.id;
    });
    users.push(id);
    return id;
  };
  const job = async (id: string) => (await db.select().from(S.generationJobs).where(eq(S.generationJobs.id, id)))[0];
  const balance = async (uid: string) => (await db.select({ b: S.users.creditBalanceTenths }).from(S.users).where(eq(S.users.id, uid)))[0].b;
  const invariant = async (uid: string) => {
    const [{ sum }] = await db.select({ sum: sql<number>`coalesce(sum(delta_tenths),0)::int` }).from(S.creditLedger).where(eq(S.creditLedger.userId, uid));
    return sum === (await balance(uid));
  };
  const puts = async () => Number((await db.execute<{ p: number }>(sql`SELECT coalesce((SELECT puts FROM blob_usage WHERE period = to_char(now() at time zone 'utc','YYYY-MM')),0) AS p`)).rows[0].p);
  const failing = (code: ConstructorParameters<typeof ProviderError>[0]) => ({ key: "test-fail", generate: async () => { throw new ProviderError(code, `simulated ${code}`); } });

  try {
    const u = await newUser();

    // 1. Real generation: Cloudflare -> crop 16:9 -> Blob -> asset, charged 2 credits.
    const putsBefore = await puts();
    const t0 = Date.now();
    const a = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt, aspect: "16:9", resolution: "1K", batchSize: 1 });
    check("submit charges 2 credits", (await balance(u)) === 980 && a.costTenths === 20);
    await jobs.runImageJob(a.jobId);
    const ja = await job(a.jobId);
    const [asset] = await db.select().from(S.assets).where(eq(S.assets.jobId, a.jobId));
    check("real job succeeded", ja.status === "succeeded" && ja.progress === 100, `${ja.status} ${ja.errorCode ?? ""} ${ja.errorMessage ?? ""} in ${Date.now() - t0}ms`);
    check("asset is 1024x576 and labelled generated", asset?.width === 1024 && asset?.height === 576 && asset?.source === "generated");
    if (asset) {
      const media = await storage.readMedia(asset.url.replace(/^\/media\//, ""));
      const buf = media ? Buffer.from(await new Response(media.stream).arrayBuffer()) : Buffer.alloc(0);
      check("asset is served from private Blob as a JPEG", !!media && asset.url.startsWith("/media/generations/") && buf.subarray(0, 3).toString("hex") === "ffd8ff", `${asset.url.slice(0, 40)}…, ${buf.length} bytes`);
    }
    if (!asset) throw new Error("real generation produced no asset; stopping");
    check("exactly one upload reserved", (await puts()) === putsBefore + 1, `${putsBefore} -> ${await puts()}`);

    // 2. Identical prompt+aspect: served from provider_cache, no provider call, no upload.
    const b = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt, aspect: "16:9", resolution: "1K", batchSize: 1 });
    // Same provider key as the real one, so a cache miss would call this and fail the job.
    await jobs.runImageJob(b.jobId, { provider: { ...failing("provider_error"), key: "cloudflare" } });
    const [bAsset] = await db.select().from(S.assets).where(eq(S.assets.jobId, b.jobId));
    check("cache hit: succeeded without calling the provider", (await job(b.jobId)).status === "succeeded" && bAsset?.url === asset?.url);
    check("cache hit: no new upload", (await puts()) === putsBefore + 1);
    const cached = await db.select({ key: S.providerCache.key }).from(S.providerCache).where(eq(S.providerCache.assetUrl, asset?.url ?? ""));
    cacheKeys.push(...cached.map((c) => c.key));

    // A public generated asset so the sample fallback has something to serve.
    const [pub] = await db
      .insert(S.assets)
      .values({ kind: "image", source: "generated", url: asset!.url, width: 1024, height: 576, modelId: "flux_1_schnell", prompt: "sample prompt", isPublic: true, userId: u })
      .returning({ id: S.assets.id });

    // 3. Quota exhausted: failed, refunded, labelled sample attached, never charged.
    const beforeQuota = await balance(u);
    const c = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} quota`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    await jobs.runImageJob(c.jobId, { provider: failing("quota_exhausted") });
    const jc = await job(c.jobId);
    const cAssets = await db.select().from(S.assets).where(eq(S.assets.jobId, c.jobId));
    check("quota: job failed with quota_exhausted", jc.status === "failed" && jc.errorCode === "quota_exhausted");
    check("quota: refunded (net zero)", (await balance(u)) === beforeQuota);
    check("quota: sample attached, labelled sample, with the sample's own prompt", cAssets.length === 1 && cAssets[0].source === "sample" && cAssets[0].prompt === "sample prompt");
    const [{ qe }] = await db.select({ qe: sql<number>`count(*)::int` }).from(S.systemEvents).where(and(eq(S.systemEvents.kind, "provider_quota_exhausted"), sql`detail->>'jobId' = ${c.jobId}`));
    check("quota: logged to system_events", qe === 1);

    // 4. Moderation flag: failed, refunded, no sample.
    const d = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} flagged`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    await jobs.runImageJob(d.jobId, { provider: failing("content_flagged") });
    const dAssets = await db.select().from(S.assets).where(eq(S.assets.jobId, d.jobId));
    check("flagged: failed, refunded, no sample", (await job(d.jobId)).errorCode === "content_flagged" && dAssets.length === 0 && (await balance(u)) === beforeQuota);

    // 5. Cancel a queued job, then the worker arriving late does nothing.
    const e = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} cancel-queued`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    check("cancel queued -> canceled", await jobs.cancelJob(u, e.jobId));
    await jobs.runImageJob(e.jobId, { provider: failing("provider_error") });
    check("late worker leaves canceled job untouched, refunded once", (await job(e.jobId)).status === "canceled" && (await balance(u)) === beforeQuota);
    check("second cancel is refused", !(await jobs.cancelJob(u, e.jobId)));

    // 6. Cancel mid-processing: slow provider, cancel while it runs, outputs discarded.
    const f = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} cancel-processing`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    const slow = { key: "test-slow", generate: async () => { await new Promise((r) => setTimeout(r, 1500)); throw new ProviderError("provider_error", "should be ignored"); } };
    const running = jobs.runImageJob(f.jobId, { provider: slow });
    await new Promise((r) => setTimeout(r, 400));
    check("cancel while processing -> canceled", await jobs.cancelJob(u, f.jobId));
    await running;
    const jf = await job(f.jobId);
    const [{ refunds }] = await db.select({ refunds: sql<number>`count(*)::int` }).from(S.creditLedger).where(and(eq(S.creditLedger.jobId, f.jobId), eq(S.creditLedger.reason, "generation_refund")));
    check("worker failure after cancel doesn't overwrite status or double-refund", jf.status === "canceled" && jf.errorCode === null && refunds === 1);

    // 7. Sweep: a queued job whose worker never ran.
    const g = await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} stale`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    await db.update(S.generationJobs).set({ createdAt: sql`now() - interval '5 minutes'` }).where(eq(S.generationJobs.id, g.jobId));
    const swept = await jobs.sweepStaleJobs(true);
    check("sweep fails and refunds a stale job", swept >= 1 && (await job(g.jobId)).errorCode === "worker_lost" && (await balance(u)) === beforeQuota);

    // 8. Retry charges again and links to the original.
    const r = await jobs.retryJob(u, d.jobId);
    const jr = await job(r.jobId);
    check("retry creates a linked, charged job", jr.retryOfJobId === d.jobId && (await balance(u)) === beforeQuota - 20);
    await jobs.cancelJob(u, r.jobId);

    // 9. Active-job limit.
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} active ${i}`, aspect: "1:1", resolution: "1K", batchSize: 1 })).jobId);
    let limited = false;
    try {
      await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt: `${prompt} fifth`, aspect: "1:1", resolution: "1K", batchSize: 1 });
    } catch (err) {
      limited = err instanceof jobs.JobInputError && err.status === 429;
    }
    check("5th concurrent job refused with 429", limited);
    for (const id of ids) await jobs.cancelJob(u, id);

    // 10. Validation and insufficient credits.
    let bad = 0;
    for (const input of [
      { aspect: "21:9" },
      { batchSize: 9 },
      { prompt: "hi" },
      { modelId: "flux_2_klein_4b" },
    ]) {
      try {
        await jobs.submitImageJob(u, { modelId: "flux_1_schnell", prompt, aspect: "1:1", resolution: "1K", batchSize: 1, ...input });
      } catch (err) {
        if (err instanceof jobs.JobInputError) bad++;
      }
    }
    check("invalid aspect/batch/prompt/inactive model rejected", bad === 4);
    const poor = await newUser(10);
    let insufficient = false;
    try {
      await jobs.submitImageJob(poor, { modelId: "flux_1_schnell", prompt, aspect: "1:1", resolution: "1K", batchSize: 1 });
    } catch (err) {
      insufficient = err instanceof ledger.InsufficientCreditsError;
    }
    const [{ poorJobs }] = await db.select({ poorJobs: sql<number>`count(*)::int` }).from(S.generationJobs).where(eq(S.generationJobs.userId, poor));
    check("1-credit user can't submit; no job row left behind", insufficient && poorJobs === 0);

    // 11. Storage cap on an isolated test period.
    const period = `test-${stamp}`;
    await db.insert(S.blobUsage).values({ period, puts: 1500 });
    let capped = false;
    try {
      await storage.reserveUpload(period);
    } catch (err) {
      capped = err instanceof storage.StorageCapReachedError;
    }
    const [{ capEvents }] = await db.select({ capEvents: sql<number>`count(*)::int` }).from(S.systemEvents).where(and(eq(S.systemEvents.kind, "blob_cap_reached"), sql`detail->>'period' = ${period}`));
    check("upload 1,501 refused and logged once", capped && capEvents === 1);
    await db.delete(S.blobUsage).where(eq(S.blobUsage.period, period));
    await db.delete(S.systemEvents).where(and(eq(S.systemEvents.kind, "blob_cap_reached"), sql`detail->>'period' = ${period}`));

    check("ledger sum == balance for the test user", await invariant(u));
    await db.delete(S.assets).where(eq(S.assets.id, pub.id));
  } finally {
    if (users.length) {
      const jobIds = (await db.select({ id: S.generationJobs.id }).from(S.generationJobs).where(inArray(S.generationJobs.userId, users))).map((j) => j.id);
      if (jobIds.length) await db.delete(S.systemEvents).where(sql`detail->>'jobId' = ANY(${sql.raw(`ARRAY[${jobIds.map((i) => `'${i}'`).join(",")}]::text[]`)})`);
      await db.delete(S.users).where(inArray(S.users.id, users));
    }
    await db.delete(S.systemEvents).where(sql`kind = 'jobs_swept' AND created_at > now() - interval '5 minutes'`);
    if (cacheKeys.length) await db.delete(S.providerCache).where(inArray(S.providerCache.key, cacheKeys));
    console.log(`cleanup: removed ${users.length} test users with their jobs, assets, ledger rows and events`);
    await pool.end();
  }

  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
