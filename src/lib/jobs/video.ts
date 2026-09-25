import "server-only";
import { and, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, generationJobs, type JobParams, models, plans, presets, users } from "@/db/schema";
import { chargeForJob, type Tx } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";
import { estimateRenderMs, renderDeadline, RESOLUTION_DIMS } from "@/lib/render/budget";
import { RenderBudgetError, renderCameraMove } from "@/lib/render/camera";
import { decideRender, FALLBACK_COPY, type FallbackReason } from "@/lib/render/policy";
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

export async function submitVideoJob(userId: string, input: VideoSubmitInput): Promise<{ jobId: string; costTenths: number; live: boolean; reason?: FallbackReason }> {
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

  return db.transaction(async (tx) => {
    // Lock the user row so two quick submits can't both claim the last live render.
    const locked = await tx.execute<{ kind: "guest" | "registered" }>(sql`SELECT kind FROM users WHERE id = ${userId} FOR UPDATE`);
    const kind = locked.rows[0]?.kind ?? "guest";

    const [{ active }] = await tx
      .select({ active: sql<number>`count(*)::int` })
      .from(generationJobs)
      .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "processing"])));
    if (active >= MAX_ACTIVE_JOBS_PER_USER) {
      throw new JobInputError(`You can run ${MAX_ACTIVE_JOBS_PER_USER} generations at once. Wait for one to finish.`, 429, "too_many_active");
    }

    const decision = await decideRender(userId, kind, preset.motion.type, tx);
    if (!decision.live) {
      // Serve a pre-rendered clip of the chosen preset: never charged, labelled as an example.
      const clip = await findPrerenderedClip(tx, preset.id, input.aspect);
      if (!clip) throw new JobInputError("No pre-rendered example is available for this preset yet.", 503, "no_prerendered_clip");
      const [job] = await tx
        .insert(generationJobs)
        .values({
          userId,
          vertical: "video",
          modelId: model.id,
          presetId: preset.id,
          inputAssetId: image.id,
          prompt: `${preset.name}: pre-rendered example`,
          params,
          costTenths: 0,
          status: "succeeded",
          progress: 100,
          providerKey: "prerendered",
          providerState: { served: "prerendered", reason: decision.reason, clipAssetId: clip.id },
          startedAt: sql`now()`,
          finishedAt: sql`now()`,
          retryOfJobId: input.retryOfJobId ?? null,
        })
        .returning({ id: generationJobs.id });
      await tx.insert(assets).values({
        userId,
        jobId: job.id,
        kind: "video",
        source: "sample",
        url: clip.url,
        posterUrl: clip.posterUrl,
        width: clip.width,
        height: clip.height,
        durationMs: clip.durationMs,
        modelId: model.id,
        presetId: preset.id,
        prompt: `${preset.name}: pre-rendered example (${FALLBACK_COPY[decision.reason]})`,
        aspect: input.aspect,
        // Rendered over a library still, not the user's image: the compare view must know.
        sourceAssetId: clip.sourceAssetId,
      });
      return { jobId: job.id, costTenths: 0, live: false as const, reason: decision.reason };
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
        providerState: { served: "live" },
        retryOfJobId: input.retryOfJobId ?? null,
      })
      .returning({ id: generationJobs.id });
    await chargeForJob(tx, userId, job.id, costTenths);
    return { jobId: job.id, costTenths, live: true as const };
  });
}

// Pre-rendered clips live under renders/library-<preset>-<aspect>-... (scripts/seed-render-library.ts).
// Prefer the chosen preset and aspect, then the same preset in any aspect, then General.
async function findPrerenderedClip(tx: Tx, presetId: string, aspect: string) {
  // The library is identified by its columns, never by how its files happen to be named:
  // collection 'render_library', the preset it renders, and the aspect it was rendered at.
  const pick = (where: SQL | undefined) =>
    tx
      .select({ id: assets.id, url: assets.url, posterUrl: assets.posterUrl, width: assets.width, height: assets.height, durationMs: assets.durationMs, sourceAssetId: assets.sourceAssetId })
      .from(assets)
      .where(and(eq(assets.collection, "render_library"), isNull(assets.deletedAt), where))
      .limit(1);

  const [exact] = await pick(and(eq(assets.presetId, presetId), eq(assets.aspect, aspect)));
  if (exact) return exact;
  const [samePreset] = await pick(eq(assets.presetId, presetId));
  if (samePreset) return samePreset;
  const [sameAspect] = await pick(eq(assets.aspect, aspect));
  return sameAspect ?? null;
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
        .set({ status: "succeeded", progress: 100, finishedAt: sql`now()`, heartbeatAt: sql`now()`, // Merge, don't replace: `served: "live"` must survive, it's what the live-render cap counts.
          providerState: sql`coalesce(${generationJobs.providerState}, '{}'::jsonb) || ${JSON.stringify({ renderMs: out.renderMs, estimateMs: Math.round(estimate) })}::jsonb` })
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
        aspect: job.params.aspect,
        sourceAssetId: job.inputAssetId,
      });
    });
  } catch (err) {
    if (err instanceof RenderBudgetError) {
      await failJob(jobId, "render_budget", "This render wouldn't finish within the server's time limit. Try 720p or 5s. Your credits were refunded.");
    } else if (err instanceof StorageCapReachedError) {
      await failJob(jobId, "storage_cap", "New uploads are paused for this month. Your credits were refunded.");
    } else {
      console.error(`[video] ${jobId} failed`, err);
      await failJob(jobId, "render_error", "The render failed. Your credits were refunded.");
    }
  }
}
