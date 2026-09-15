import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, generationJobs, type JobParams, models, plans, presets, users } from "@/db/schema";
import { chargeForJob } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";
import { estimateRenderMs, renderDeadline, RESOLUTION_DIMS } from "@/lib/render/budget";
import { RenderBudgetError, renderCameraMove } from "@/lib/render/camera";
import { readMedia, StorageCapReachedError, uploadMedia } from "@/lib/storage";
import { failJob, JobInputError, stillProcessing } from "./service";

// Video jobs: ADD IMAGE -> CHOOSE PRESET -> GET VIDEO (recon 17). The "model" is the camera
// renderer: a real ffmpeg transform of a real still into a real MP4, never labelled as
// model-generated video. Same lifecycle, charging and refund guarantees as image jobs.

const MAX_ACTIVE_JOBS_PER_USER = 4;

export type VideoSubmitInput = {
  modelId: string;
  presetId: string;
  inputAssetId: string;
  aspect: string;
  resolution: string;
  durationS: number;
  retryOfJobId?: string | null;
};

export async function submitVideoJob(userId: string, input: VideoSubmitInput): Promise<{ jobId: string; costTenths: number }> {
  const [row] = await db
    .select({ model: models, planRank: plans.rank })
    .from(models)
    .innerJoin(users, eq(users.id, userId))
    .innerJoin(plans, eq(plans.id, users.planId))
    .where(eq(models.id, input.modelId))
    .limit(1);
  if (!row || !row.model.active || row.model.vertical !== "video") throw new JobInputError("That video model isn't available.");
  const { model } = row;
  if (row.planRank < model.minPlanRank) throw new JobInputError("That model needs a higher plan.", 402, "plan_required");
  const caps = model.capabilities;
  if (!caps.aspects.includes(input.aspect)) throw new JobInputError("Unsupported aspect ratio.");
  if (!caps.resolutions.includes(input.resolution)) throw new JobInputError("Unsupported resolution.");
  if (!caps.durations?.includes(input.durationS)) throw new JobInputError("Unsupported duration.");

  const [preset] = await db.select().from(presets).where(eq(presets.id, input.presetId));
  if (!preset) throw new JobInputError("Choose a preset.");

  // The input image must be the user's own image, or a public library image.
  const [image] = await db
    .select({ id: assets.id, prompt: assets.prompt })
    .from(assets)
    .where(
      and(
        eq(assets.id, input.inputAssetId),
        eq(assets.kind, "image"),
        isNull(assets.deletedAt),
        or(eq(assets.userId, userId), and(isNull(assets.userId), eq(assets.isPublic, true))),
      ),
    );
  if (!image) throw new JobInputError("Add an image to animate.");

  const params: JobParams = { aspect: input.aspect, resolution: input.resolution, batchSize: 1, durationS: input.durationS };
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
        vertical: "video",
        modelId: model.id,
        presetId: preset.id,
        inputAssetId: image.id,
        prompt: `${preset.name}: ${image.prompt ?? "your image"}`,
        params,
        costTenths,
        providerKey: model.providerKey,
        retryOfJobId: input.retryOfJobId ?? null,
      })
      .returning({ id: generationJobs.id });
    await chargeForJob(tx, userId, job.id, costTenths);
    return job.id;
  });
  return { jobId, costTenths };
}

// Runs a queued video job. `invokedAtMs` is when the function invocation began (the POST that
// scheduled this via after()), so the budget reflects the time actually left.
export async function runVideoJob(jobId: string, invokedAtMs = Date.now()): Promise<void> {
  const [job] = await db
    .update(generationJobs)
    .set({ status: "processing", startedAt: sql`now()`, heartbeatAt: sql`now()`, progress: 3 })
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "queued")))
    .returning();
  if (!job) return;

  try {
    const [preset] = await db.select().from(presets).where(eq(presets.id, job.presetId!));
    const [input] = await db.select().from(assets).where(eq(assets.id, job.inputAssetId!));
    const dims = RESOLUTION_DIMS[job.params.resolution]?.[job.params.aspect];
    if (!preset || !input || !dims) throw new Error("job references missing preset, input or size");

    // Assert the time budget before starting, so an impossible render fails fast and refunds.
    const deadlineMs = renderDeadline(invokedAtMs);
    const estimate = estimateRenderMs(preset.motion.type, dims.width, dims.height, job.params.durationS ?? 5);
    if (Date.now() + estimate > deadlineMs) throw new RenderBudgetError(estimate, deadlineMs - Date.now());

    const media = await readMedia(input.url.replace(/^\/media\//, ""));
    if (!media) throw new Error("input image unreadable");
    const image = Buffer.from(await new Response(media.stream).arrayBuffer());

    let lastWrite = 0;
    const out = await renderCameraMove({
      image,
      motion: preset.motion,
      width: dims.width,
      height: dims.height,
      durationS: job.params.durationS ?? 5,
      deadlineMs,
      onProgress: (fraction) => {
        if (Date.now() - lastWrite < 800) return;
        lastWrite = Date.now();
        void db
          .update(generationJobs)
          .set({ progress: Math.round(5 + fraction * 85), heartbeatAt: sql`now()` })
          .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "processing")));
      },
    });

    if (!(await stillProcessing(jobId))) return; // canceled or swept during the render

    const [video, poster] = await Promise.all([
      uploadMedia(`renders/${jobId}.mp4`, out.mp4, "video/mp4"),
      uploadMedia(`renders/${jobId}-poster.jpg`, out.poster, "image/jpeg"),
    ]);

    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(generationJobs)
        .set({ status: "succeeded", progress: 100, finishedAt: sql`now()`, heartbeatAt: sql`now()`, providerState: { renderMs: out.renderMs, estimateMs: Math.round(estimate) } })
        .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, "processing")))
        .returning({ id: generationJobs.id });
      if (!done) return;
      await tx.insert(assets).values({
        userId: job.userId,
        jobId,
        kind: "video",
        source: "rendered",
        url: video.url,
        posterUrl: poster.url,
        width: out.width,
        height: out.height,
        durationMs: out.durationMs,
        modelId: job.modelId,
        presetId: preset.id,
        prompt: job.prompt,
      });
    });
  } catch (err) {
    if (err instanceof RenderBudgetError) {
      await failJob(jobId, "render_budget", "This render wouldn't finish within the server's time limit. Try 720p or 5s. Your credits were refunded.", false);
    } else if (err instanceof StorageCapReachedError) {
      await failJob(jobId, "storage_cap", "New uploads are paused for this month. Your credits were refunded.", false);
    } else {
      console.error(`[video] ${jobId} failed`, err);
      await failJob(jobId, "render_error", "The render failed. Your credits were refunded.", false);
    }
  }
}
