import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, generationJobs, type JobParams, models, plans, providerCache, systemEvents, users } from "@/db/schema";
import { chargeForJob, refundJob } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";
import { StorageCapReachedError, uploadMedia } from "@/lib/storage";
import { assertImageAllowance, DailyLimitError, markImagesExhausted, reserveImageCall, siteMessage } from "./image-quota";
import { fixtureMode, fixtureProvider } from "./providers/fixture";
import { cropToAspect } from "./image";
import { cloudflareProvider } from "./providers/cloudflare";
import { type ImageProvider, ProviderError, type ProviderErrorCode } from "./providers/types";

// Job lifecycle: queued -> processing -> succeeded | failed | canceled.
// Every transition is a guarded UPDATE (... WHERE status IN (allowed)), so a worker, a
// user cancel and the stale-job sweep can race without double-finishing a job; refunds
// are exactly-once in refundJob().

const PROVIDERS: Record<string, ImageProvider> = { cloudflare: cloudflareProvider };
const MAX_ACTIVE_JOBS_PER_USER = 4;
// The image provider's free allowance is a daily one that resets at 00:00 UTC. When it's
// gone the job fails and is refunded: this app never substitutes another image for one the
// model didn't generate.
const QUOTA_CODES: ProviderErrorCode[] = ["quota_exhausted", "rate_limited", "not_configured"];

export function providerFailureMessage(code: ProviderErrorCode, fallback: string): string {
  if (code === "quota_exhausted") return `${siteMessage()} Your credits were refunded.`;
  if (code === "rate_limited") return "The image provider is handling too many requests right now. Try again in a minute. Your credits were refunded.";
  if (code === "not_configured") return "Image generation isn't configured on this deployment. Your credits were refunded.";
  return fallback;
}

export class JobInputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "invalid_input",
  ) {
    super(message);
  }
}

export type SubmitInput = {
  modelId: string;
  prompt: string;
  aspect: string;
  resolution: string;
  batchSize: number;
  retryOfJobId?: string | null;
  clientIpHash?: string | null;
};

export async function submitImageJob(userId: string, input: SubmitInput): Promise<{ jobId: string; costTenths: number }> {
  const prompt = input.prompt.trim();
  if (prompt.length < 3) throw new JobInputError("Describe the image in a few words.");
  if (prompt.length > 2000) throw new JobInputError("Keep the prompt under 2,000 characters.");

  const [row] = await db
    .select({ model: models, planRank: plans.rank })
    .from(models)
    .innerJoin(users, eq(users.id, userId))
    .innerJoin(plans, eq(plans.id, users.planId))
    .where(eq(models.id, input.modelId))
    .limit(1);
  if (!row || !row.model.active || row.model.vertical !== "image") throw new JobInputError("That model isn't available.");
  const { model } = row;
  if (row.planRank < model.minPlanRank) throw new JobInputError("That model needs a higher plan.", 402, "plan_required");
  const caps = model.capabilities;
  if (!caps.aspects.includes(input.aspect)) throw new JobInputError("Unsupported aspect ratio for this model.");
  if (!caps.resolutions.includes(input.resolution)) throw new JobInputError("Unsupported resolution for this model.");
  const batchSize = Math.floor(input.batchSize);
  if (!(batchSize >= 1 && batchSize <= caps.maxBatch)) throw new JobInputError(`Batch size must be 1–${caps.maxBatch}.`);

  const params: JobParams = { aspect: input.aspect, resolution: input.resolution, batchSize };
  const { costTenths } = priceJob(model.pricing, params);

  const jobId = await db.transaction(async (tx) => {
    // The user row is locked so two quick submits can't both fit into the last free images.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const [{ active }] = await tx
      .select({ active: sql<number>`count(*)::int` })
      .from(generationJobs)
      .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "processing"])));
    if (active >= MAX_ACTIVE_JOBS_PER_USER) {
      throw new JobInputError(`You can run ${MAX_ACTIVE_JOBS_PER_USER} generations at once. Wait for one to finish.`, 429, "too_many_active");
    }
    // Before any charge. A fixture run (tests, off Vercel only) spends nothing, so the site-wide
    // allowance isn't checked for it; the per-visitor and per-network caps still are.
    await assertImageAllowance(tx, userId, input.clientIpHash ?? null, batchSize, { site: !fixtureMode() });
    const [job] = await tx
      .insert(generationJobs)
      .values({
        userId,
        vertical: "image",
        modelId: model.id,
        prompt,
        params,
        costTenths,
        providerKey: fixtureMode() ? fixtureProvider.key : model.providerKey,
        clientIpHash: input.clientIpHash ?? null,
        retryOfJobId: input.retryOfJobId ?? null,
      })
      .returning({ id: generationJobs.id });
    await chargeForJob(tx, userId, job.id, costTenths); // throws InsufficientCreditsError -> whole tx rolls back
    return job.id;
  });

  return { jobId, costTenths };
}

type RunOptions = { provider?: ImageProvider };

// Runs a queued image job to completion. Called via after() right after submit.
export async function runImageJob(jobId: string, opts: RunOptions = {}): Promise<void> {
  const [job] = await db
    .update(generationJobs)
    .set({ status: "processing", startedAt: sql`now()`, heartbeatAt: sql`now()`, progress: 5 })
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "queued")))
    .returning();
  if (!job) return; // already claimed, canceled or swept

  try {
    const [model] = await db.select().from(models).where(eq(models.id, job.modelId));
    const provider = opts.provider ?? (job.providerKey === fixtureProvider.key ? fixtureProvider : PROVIDERS[model.providerKey]);
    if (!provider) throw new ProviderError("not_configured", `No provider for ${model.providerKey}`);

    const outputs: { url: string; width: number; height: number }[] = [];
    for (let i = 0; i < job.params.batchSize; i++) {
      if (!(await stillProcessing(jobId))) return; // canceled or swept meanwhile; already refunded

      const cacheKey = createHash("sha256")
        .update(JSON.stringify([provider.key, model.providerModelRef, job.prompt.toLowerCase().replace(/\s+/g, " "), job.params.aspect, i]))
        .digest("hex");
      const [cached] = await db.select().from(providerCache).where(eq(providerCache.key, cacheKey));
      if (cached) {
        await db.update(providerCache).set({ hits: sql`${providerCache.hits} + 1` }).where(eq(providerCache.key, cacheKey));
        outputs.push({ url: cached.assetUrl, width: cached.width, height: cached.height });
      } else {
        // Only a call to the real provider spends the shared daily allowance.
        if (provider === cloudflareProvider) await reserveImageCall();
        const image = await provider.generate({ modelRef: model.providerModelRef, prompt: job.prompt });
        const cropped = await cropToAspect(image.bytes, job.params.aspect);
        const { url } = await uploadMedia(`generations/${jobId}-${i}.jpg`, cropped.bytes, "image/jpeg");
        await db
          .insert(providerCache)
          .values({ key: cacheKey, assetUrl: url, width: cropped.width, height: cropped.height })
          .onConflictDoNothing();
        outputs.push({ url, width: cropped.width, height: cropped.height });
      }
      await db
        .update(generationJobs)
        .set({ progress: Math.round(5 + ((i + 1) / job.params.batchSize) * 90), heartbeatAt: sql`now()` })
        .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "processing")));
    }

    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(generationJobs)
        .set({ status: "succeeded", progress: 100, finishedAt: sql`now()`, heartbeatAt: sql`now()` })
        .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "processing")))
        .returning({ id: generationJobs.id });
      if (!done) return; // canceled or swept at the last moment: outputs are discarded, refund already made
      await tx.insert(assets).values(
        outputs.map((o) => ({
          userId: job.userId,
          jobId,
          kind: "image" as const,
          source: "generated" as const,
          url: o.url,
          width: o.width,
          height: o.height,
          modelId: job.modelId,
          prompt: job.prompt,
          aspect: job.params.aspect,
        })),
      );
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      if (QUOTA_CODES.includes(err.code)) {
        await db.insert(systemEvents).values({ kind: `provider_${err.code}`, detail: { jobId, detail: err.detail ?? null } });
      }
      // Only the real provider's word marks the day used up (never a test double's).
      if (err.code === "quota_exhausted" && !opts.provider && job.providerKey === "cloudflare") await markImagesExhausted();
      await failJob(jobId, err.code, providerFailureMessage(err.code, err.message));
    } else if (err instanceof DailyLimitError) {
      await failJob(jobId, "quota_exhausted", `${err.message} Your credits were refunded.`);
    } else if (err instanceof StorageCapReachedError) {
      await failJob(jobId, "storage_cap", "New uploads are paused for this month. Your credits were refunded.");
    } else {
      console.error(`[jobs] ${jobId} crashed`, err);
      await failJob(jobId, "internal_error", "Something went wrong on our side. Your credits were refunded.");
    }
  }
}

export async function stillProcessing(jobId: string): Promise<boolean> {
  const [row] = await db.select({ status: generationJobs.status }).from(generationJobs).where(eq(generationJobs.id, jobId));
  return row?.status === "processing";
}

// Marks a job failed and refunds it, exactly once. A failed job has no output: this app
// never attaches a stand-in image in place of a generation it didn't produce.
export async function failJob(jobId: string, code: string, message: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [failed] = await tx
      .update(generationJobs)
      .set({ status: "failed", errorCode: code, errorMessage: message, finishedAt: sql`now()` })
      .where(and(eq(generationJobs.id, jobId), inArray(generationJobs.status, ["queued", "processing"])))
      .returning();
    if (!failed) return false;
    await refundJob(tx, jobId, `Refund: ${code}`);
    return true;
  });
}

export async function cancelJob(userId: string, jobId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [canceled] = await tx
      .update(generationJobs)
      .set({ status: "canceled", cancelRequestedAt: sql`now()`, finishedAt: sql`now()` })
      .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "processing"])))
      .returning({ id: generationJobs.id });
    if (!canceled) return false;
    await refundJob(tx, jobId, "Refund: canceled");
    return true;
  });
}

export async function retryJob(userId: string, jobId: string, clientIpHash: string | null = null): Promise<{ jobId: string; vertical: "image" | "video"; live: boolean }> {
  const [old] = await db
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)));
  if (!old) throw new JobInputError("Job not found.", 404, "not_found");
  if (old.status !== "failed" && old.status !== "canceled") throw new JobInputError("Only failed or canceled jobs can be retried.");
  if (old.vertical === "video") {
    const { submitVideoJob } = await import("./video");
    const r = await submitVideoJob(userId, {
      modelId: old.modelId,
      presetId: old.presetId ?? "",
      inputAssetId: old.inputAssetId ?? "",
      aspect: old.params.aspect,
      resolution: old.params.resolution,
      durationS: old.params.durationS ?? 5,
      retryOfJobId: old.id,
    });
    return { jobId: r.jobId, vertical: "video", live: r.live };
  }
  const r = await submitImageJob(userId, { modelId: old.modelId, prompt: old.prompt, ...old.params, retryOfJobId: old.id, clientIpHash });
  return { jobId: r.jobId, vertical: "image", live: true };
}

// Fails and refunds jobs whose worker vanished (function killed, deploy, crash).
// Called from polling traffic, throttled per instance; there is no minute cron on Hobby.
let lastSweep = 0;
export async function sweepStaleJobs(force = false): Promise<number> {
  if (!force && Date.now() - lastSweep < 30_000) return 0;
  lastSweep = Date.now();
  const stale = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      sql`(${generationJobs.status} = 'processing' AND ${generationJobs.heartbeatAt} < now() - interval '120 seconds')
       OR (${generationJobs.status} = 'queued' AND ${generationJobs.createdAt} < now() - interval '90 seconds')`,
    )
    .limit(50);
  let n = 0;
  for (const { id } of stale) {
    if (await failJob(id, "worker_lost", "This generation stopped unexpectedly. Your credits were refunded.")) n++;
  }
  if (n) await db.insert(systemEvents).values({ kind: "jobs_swept", detail: { count: n } });
  return n;
}

export type JobView = Awaited<ReturnType<typeof listJobs>>[number];

export async function listJobs(userId: string, opts: { vertical?: "image" | "video"; ids?: string[]; limit?: number } = {}) {
  const conditions = [eq(generationJobs.userId, userId)];
  if (opts.vertical) conditions.push(eq(generationJobs.vertical, opts.vertical));
  if (opts.ids?.length) conditions.push(inArray(generationJobs.id, opts.ids));
  const jobs = await db
    .select({
      id: generationJobs.id,
      vertical: generationJobs.vertical,
      status: generationJobs.status,
      progress: generationJobs.progress,
      prompt: generationJobs.prompt,
      modelId: generationJobs.modelId,
      modelName: models.name,
      presetId: generationJobs.presetId,
      params: generationJobs.params,
      costTenths: generationJobs.costTenths,
      errorCode: generationJobs.errorCode,
      errorMessage: generationJobs.errorMessage,
      createdAt: generationJobs.createdAt,
      finishedAt: generationJobs.finishedAt,
    })
    .from(generationJobs)
    .innerJoin(models, eq(models.id, generationJobs.modelId))
    .where(and(...conditions))
    .orderBy(desc(generationJobs.createdAt))
    .limit(opts.limit ?? 40);
  const jobAssets = jobs.length
    ? await db
        .select({ id: assets.id, jobId: assets.jobId, url: assets.url, posterUrl: assets.posterUrl, width: assets.width, height: assets.height, durationMs: assets.durationMs, kind: assets.kind, source: assets.source, prompt: assets.prompt })
        .from(assets)
        .where(and(inArray(assets.jobId, jobs.map((j) => j.id)), sql`${assets.deletedAt} IS NULL`))
    : [];
  return jobs.map((j) => ({ ...j, assets: jobAssets.filter((a) => a.jobId === j.id) }));
}

export async function balanceOf(userId: string): Promise<number> {
  const [u] = await db.select({ b: users.creditBalanceTenths }).from(users).where(eq(users.id, userId));
  return u?.b ?? 0;
}
