import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, generationJobs, type JobParams, models, plans, providerCache, systemEvents, users } from "@/db/schema";
import { chargeForJob, refundJob } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";
import { StorageCapReachedError, uploadMedia } from "@/lib/storage";
import { cropToAspect } from "./image";
import { cloudflareProvider } from "./providers/cloudflare";
import { type ImageProvider, ProviderError, type ProviderErrorCode } from "./providers/types";

// Job lifecycle: queued -> processing -> succeeded | failed | canceled.
// Every transition is a guarded UPDATE (... WHERE status IN (allowed)), so a worker, a
// user cancel and the stale-job sweep can race without double-finishing a job; refunds
// are exactly-once in refundJob().

const PROVIDERS: Record<string, ImageProvider> = { cloudflare: cloudflareProvider };
const MAX_ACTIVE_JOBS_PER_USER = 4;
const SAMPLE_ON: ProviderErrorCode[] = ["quota_exhausted", "rate_limited", "not_configured"];

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
    const [{ active }] = await tx
      .select({ active: sql<number>`count(*)::int` })
      .from(generationJobs)
      .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "processing"])));
    if (active >= MAX_ACTIVE_JOBS_PER_USER) {
      throw new JobInputError(`You can run ${MAX_ACTIVE_JOBS_PER_USER} generations at once. Wait for one to finish.`, 429, "too_many_active");
    }
    const [job] = await tx
      .insert(generationJobs)
      .values({
        userId,
        vertical: "image",
        modelId: model.id,
        prompt,
        params,
        costTenths,
        providerKey: model.providerKey,
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
    const provider = opts.provider ?? PROVIDERS[model.providerKey];
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
        })),
      );
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      if (err.code === "quota_exhausted" || err.code === "rate_limited") {
        await db.insert(systemEvents).values({ kind: `provider_${err.code}`, detail: { jobId, detail: err.detail ?? null } });
      }
      await failJob(jobId, err.code, err.message, SAMPLE_ON.includes(err.code));
    } else if (err instanceof StorageCapReachedError) {
      await failJob(jobId, "storage_cap", "New uploads are paused for this month. Your credits were refunded.", true);
    } else {
      console.error(`[jobs] ${jobId} crashed`, err);
      await failJob(jobId, "internal_error", "Something went wrong on our side. Your credits were refunded.", false);
    }
  }
}

export async function stillProcessing(jobId: string): Promise<boolean> {
  const [row] = await db.select({ status: generationJobs.status }).from(generationJobs).where(eq(generationJobs.id, jobId));
  return row?.status === "processing";
}

// Marks a job failed and refunds it, exactly once. With `withSample`, attaches existing
// public model outputs as clearly labelled samples: no upload, no charge.
export async function failJob(jobId: string, code: string, message: string, withSample: boolean): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [failed] = await tx
      .update(generationJobs)
      .set({ status: "failed", errorCode: code, errorMessage: message, finishedAt: sql`now()` })
      .where(and(eq(generationJobs.id, jobId), inArray(generationJobs.status, ["queued", "processing"])))
      .returning();
    if (!failed) return false;
    await refundJob(tx, jobId, `Refund: ${code}`);
    if (withSample) {
      const samples = await tx
        .select({ url: assets.url, width: assets.width, height: assets.height, modelId: assets.modelId, prompt: assets.prompt })
        .from(assets)
        .where(and(eq(assets.isPublic, true), eq(assets.kind, "image"), eq(assets.source, "generated")))
        .orderBy(sql`random()`)
        .limit(failed.params.batchSize);
      if (samples.length) {
        await tx.insert(assets).values(
          samples.map((s) => ({
            userId: failed.userId,
            jobId,
            kind: "image" as const,
            source: "sample" as const,
            url: s.url,
            width: s.width,
            height: s.height,
            modelId: s.modelId,
            prompt: s.prompt, // the sample's own prompt, never the user's
          })),
        );
      }
    }
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

export async function retryJob(userId: string, jobId: string): Promise<{ jobId: string; vertical: "image" | "video"; live: boolean }> {
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
  const r = await submitImageJob(userId, { modelId: old.modelId, prompt: old.prompt, ...old.params, retryOfJobId: old.id });
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
    if (await failJob(id, "worker_lost", "This generation stopped unexpectedly. Your credits were refunded.", false)) n++;
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
