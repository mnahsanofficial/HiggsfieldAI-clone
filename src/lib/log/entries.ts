import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, creditLedger, generationJobs, models, presets, users } from "@/db/schema";
import type { FallbackReason } from "@/lib/render/policy";

// The log read model: one row per run, joining what the job was, what came out of it, and
// what the ledger did about it. Docket reads the whole product from this, so a reviewer can
// see the model that ran, the credits charged and any refund without being told to trust it.
//
// Two kinds of entry share the shape:
//  - 'run'     a real generation job belonging to an account
//  - 'library' a row from the public seed collection, which is how the public log has
//              something in it before anyone publishes anything
//
// Visibility: a run is private to its owner unless it has been published (jobs.published_at),
// which only registered accounts can do. Guests' runs are never public.

export type LogAsset = {
  id: string;
  kind: "image" | "video";
  source: "generated" | "rendered" | "sample" | "upload";
  url: string;
  posterUrl: string | null;
  width: number;
  height: number;
  durationMs: number | null;
  aspect: string | null;
  prompt: string | null;
  sourceAssetId: string | null;
};

export type LogEntry = {
  id: string;
  type: "run" | "library";
  vertical: "image" | "video";
  status: "queued" | "processing" | "succeeded" | "failed" | "canceled";
  progress: number;
  prompt: string;
  modelId: string;
  modelName: string;
  presetId: string | null;
  presetName: string | null;
  params: Record<string, unknown> | null;
  // Money, as it happened: what was taken, what came back, and what the entry should say.
  costTenths: number;
  chargedTenths: number;
  refundedTenths: number;
  // Your balance right after this run's last ledger movement (null when nothing moved).
  balanceAfterTenths: number | null;
  settlement: "charged" | "refunded" | "free";
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  published: boolean;
  mine: boolean;
  // A camera move is either rendered live for this run or served from the pre-rendered
  // library (free, and labelled). The reason says why, in the user's terms.
  servedAs: "live" | "prerendered" | null;
  fallbackReason: FallbackReason | null;
  // What the user picked to animate (a camera-move run), and the still the take was actually
  // rendered over. They are the same for a live render; for a pre-rendered example the take
  // was rendered over a library still, and the before/after view compares against that one.
  inputAsset: LogAsset | null;
  renderedFrom: LogAsset | null;
  assets: LogAsset[];
};

const assetCols = {
  id: assets.id,
  kind: assets.kind,
  source: assets.source,
  url: assets.url,
  posterUrl: assets.posterUrl,
  width: assets.width,
  height: assets.height,
  durationMs: assets.durationMs,
  aspect: assets.aspect,
  prompt: assets.prompt,
  sourceAssetId: assets.sourceAssetId,
};

const jobCols = {
  id: generationJobs.id,
  userId: generationJobs.userId,
  vertical: generationJobs.vertical,
  status: generationJobs.status,
  progress: generationJobs.progress,
  prompt: generationJobs.prompt,
  modelId: generationJobs.modelId,
  modelName: models.name,
  presetId: generationJobs.presetId,
  presetName: presets.name,
  params: generationJobs.params,
  costTenths: generationJobs.costTenths,
  errorCode: generationJobs.errorCode,
  errorMessage: generationJobs.errorMessage,
  createdAt: generationJobs.createdAt,
  finishedAt: generationJobs.finishedAt,
  publishedAt: generationJobs.publishedAt,
  inputAssetId: generationJobs.inputAssetId,
  providerState: generationJobs.providerState,
};

type JobRow = {
  id: string;
  userId: string;
  vertical: "image" | "video";
  status: LogEntry["status"];
  progress: number;
  prompt: string;
  modelId: string;
  modelName: string;
  presetId: string | null;
  presetName: string | null;
  params: Record<string, unknown>;
  costTenths: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  publishedAt: Date | null;
  inputAssetId: string | null;
  providerState: Record<string, unknown> | null;
};

async function hydrate(jobs: JobRow[], viewerId: string | null): Promise<LogEntry[]> {
  if (!jobs.length) return [];
  const ids = jobs.map((j) => j.id);
  const outputs = await db
    .select({ ...assetCols, jobId: assets.jobId })
    .from(assets)
    .where(and(inArray(assets.jobId, ids), isNull(assets.deletedAt)))
    .orderBy(assets.createdAt);
  const stillIds = [
    ...new Set([...jobs.map((j) => j.inputAssetId), ...outputs.map((o) => o.sourceAssetId)].filter((x): x is string => !!x)),
  ];

  const [stills, money] = await Promise.all([
    stillIds.length ? db.select(assetCols).from(assets).where(inArray(assets.id, stillIds)) : Promise.resolve([]),
    db
      .select({
        jobId: creditLedger.jobId,
        charged: sql<number>`coalesce(sum(case when ${creditLedger.reason} = 'generation_charge' then -${creditLedger.deltaTenths} else 0 end), 0)::int`,
        refunded: sql<number>`coalesce(sum(case when ${creditLedger.reason} = 'generation_refund' then ${creditLedger.deltaTenths} else 0 end), 0)::int`,
        balanceAfter: sql<number | null>`(array_agg(${creditLedger.balanceAfterTenths} order by ${creditLedger.createdAt} desc, ${creditLedger.id} desc))[1]`,
      })
      .from(creditLedger)
      .where(inArray(creditLedger.jobId, ids))
      .groupBy(creditLedger.jobId),
  ]);

  return jobs.map((j) => {
    const m = money.find((x) => x.jobId === j.id);
    const charged = m?.charged ?? 0;
    const refunded = m?.refunded ?? 0;
    return {
      id: j.id,
      type: "run",
      vertical: j.vertical,
      status: j.status,
      progress: j.progress,
      prompt: j.prompt,
      modelId: j.modelId,
      modelName: j.modelName,
      presetId: j.presetId,
      presetName: j.presetName,
      params: j.params,
      costTenths: j.costTenths,
      chargedTenths: charged,
      refundedTenths: refunded,
      // Someone's balance is theirs alone: never on another viewer's copy of a run.
      balanceAfterTenths: j.userId === viewerId ? (m?.balanceAfter ?? null) : null,
      settlement: charged === 0 ? "free" : refunded >= charged ? "refunded" : "charged",
      errorCode: j.errorCode,
      errorMessage: j.errorMessage,
      createdAt: j.createdAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
      published: !!j.publishedAt,
      mine: j.userId === viewerId,
      servedAs: j.vertical !== "video" ? null : j.providerState?.served === "prerendered" ? "prerendered" : "live",
      fallbackReason: (j.providerState?.reason as FallbackReason | undefined) ?? null,
      inputAsset: stills.find((a) => a.id === j.inputAssetId) ?? null,
      renderedFrom: stills.find((a) => a.id === outputs.find((o) => o.jobId === j.id && o.kind === "video")?.sourceAssetId) ?? null,
      assets: outputs.filter((a) => a.jobId === j.id).map(({ jobId: _jobId, ...a }) => a),
    } satisfies LogEntry;
  });
}

export async function listMyLog(userId: string, opts: { limit?: number; before?: string } = {}): Promise<LogEntry[]> {
  const where = [eq(generationJobs.userId, userId)];
  if (opts.before) where.push(lt(generationJobs.createdAt, new Date(opts.before)));
  const rows = await db
    .select(jobCols)
    .from(generationJobs)
    .innerJoin(models, eq(models.id, generationJobs.modelId))
    .leftJoin(presets, eq(presets.id, generationJobs.presetId))
    .where(and(...where))
    .orderBy(desc(generationJobs.createdAt))
    .limit(Math.min(opts.limit ?? 20, 50));
  return hydrate(rows, userId);
}

// The public log is opt-in: published runs from registered accounts, plus the seed library
// so a first visit is never an empty page. Nothing a guest makes appears here.
export async function listPublicLog(viewerId: string | null, opts: { limit?: number; before?: string } = {}): Promise<LogEntry[]> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const where = [
    isNotNull(generationJobs.publishedAt),
    eq(users.kind, "registered"),
    sql`EXISTS (SELECT 1 FROM ${assets} WHERE ${assets.jobId} = ${generationJobs.id} AND ${assets.deletedAt} IS NULL)`,
  ];
  if (opts.before) where.push(lt(generationJobs.publishedAt, new Date(opts.before)));
  const rows = await db
    .select(jobCols)
    .from(generationJobs)
    .innerJoin(models, eq(models.id, generationJobs.modelId))
    .innerJoin(users, eq(users.id, generationJobs.userId))
    .leftJoin(presets, eq(presets.id, generationJobs.presetId))
    .where(and(...where))
    .orderBy(desc(generationJobs.publishedAt))
    .limit(limit);
  const published = await hydrate(rows, viewerId);
  if (published.length >= limit) return published;
  return [...published, ...(await listLibraryEntries(limit - published.length))];
}

// Seed-collection rows presented in the log's shape. They are library items, labelled as
// such, not runs: no job, no cost, no owner.
export async function listLibraryEntries(limit = 20, id?: string): Promise<LogEntry[]> {
  const rows = await db
    .select({ ...assetCols, modelId: assets.modelId, modelName: models.name, createdAt: assets.createdAt, topic: assets.topic })
    .from(assets)
    .innerJoin(models, eq(models.id, assets.modelId))
    .where(and(eq(assets.collection, "seed"), eq(assets.isPublic, true), isNull(assets.deletedAt), id ? eq(assets.id, id) : undefined))
    .orderBy(sql`random()`)
    .limit(Math.min(limit, 50));
  return rows.map((a) => ({
    id: a.id,
    type: "library" as const,
    vertical: "image" as const,
    status: "succeeded" as const,
    progress: 100,
    prompt: a.prompt ?? "",
    modelId: a.modelId ?? "",
    modelName: a.modelName,
    presetId: null,
    presetName: null,
    params: { aspect: a.aspect },
    costTenths: 0,
    chargedTenths: 0,
    refundedTenths: 0,
    balanceAfterTenths: null,
    settlement: "free" as const,
    errorCode: null,
    errorMessage: null,
    createdAt: a.createdAt.toISOString(),
    finishedAt: a.createdAt.toISOString(),
    published: true,
    mine: false,
    servedAs: null,
    fallbackReason: null,
    inputAsset: null,
    renderedFrom: null,
    assets: [{ id: a.id, kind: a.kind, source: a.source, url: a.url, posterUrl: a.posterUrl, width: a.width, height: a.height, durationMs: a.durationMs, aspect: a.aspect, prompt: a.prompt, sourceAssetId: null }],
  }));
}

// One entry by id, for /log/<id>: the owner always sees it; anyone else only if published.
export async function getLogEntry(id: string, viewerId: string | null): Promise<LogEntry | null> {
  const rows = await db
    .select(jobCols)
    .from(generationJobs)
    .innerJoin(models, eq(models.id, generationJobs.modelId))
    .innerJoin(users, eq(users.id, generationJobs.userId))
    .leftJoin(presets, eq(presets.id, generationJobs.presetId))
    .where(
      and(
        eq(generationJobs.id, id),
        viewerId
          ? or(eq(generationJobs.userId, viewerId), and(isNotNull(generationJobs.publishedAt), eq(users.kind, "registered")))
          : and(isNotNull(generationJobs.publishedAt), eq(users.kind, "registered")),
      ),
    )
    .limit(1);
  const [entry] = await hydrate(rows, viewerId);
  if (entry) return entry;
  // Library items in the public log have permalinks too.
  const [item] = /^[0-9a-f-]{36}$/i.test(id) ? await listLibraryEntries(1, id) : [];
  return item ?? null;
}

// Credit movements that aren't runs (welcome credits, plan credits, adjustments), for the
// list view: with them, the log reconciles with the balance line by line.
export type CreditEvent = { id: string; reason: string; note: string | null; deltaTenths: number; balanceAfterTenths: number; createdAt: string };

export async function listCreditEvents(userId: string, window: { after?: string; before?: string }): Promise<CreditEvent[]> {
  const rows = await db
    .select({ id: creditLedger.id, reason: creditLedger.reason, note: creditLedger.note, deltaTenths: creditLedger.deltaTenths, balanceAfterTenths: creditLedger.balanceAfterTenths, createdAt: creditLedger.createdAt })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, userId),
        isNull(creditLedger.jobId),
        window.after ? sql`${creditLedger.createdAt} >= ${new Date(window.after)}` : undefined,
        window.before ? lt(creditLedger.createdAt, new Date(window.before)) : undefined,
      ),
    )
    .orderBy(desc(creditLedger.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, id: String(r.id), createdAt: r.createdAt.toISOString() }));
}

// Removing a run's output: the images or video are soft-deleted and the run leaves the public
// log in the same transaction. The run itself stays on the record, with what it cost.
export async function deleteOutputs(userId: string, jobId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .update(generationJobs)
      .set({ publishedAt: null })
      .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)))
      .returning({ id: generationJobs.id });
    if (!job) return false;
    await tx.update(assets).set({ deletedAt: sql`now()` }).where(and(eq(assets.jobId, jobId), eq(assets.userId, userId), isNull(assets.deletedAt)));
    return true;
  });
}

export class PublishError extends Error {}

// Publishing is the user's decision, one run at a time, and only for accounts that can be
// held to it: a guest session has no identity to attach a public prompt to.
export async function setPublished(userId: string, jobId: string, published: boolean): Promise<boolean> {
  const [user] = await db.select({ kind: users.kind }).from(users).where(eq(users.id, userId));
  if (!user) throw new PublishError("Account not found.");
  if (published && user.kind !== "registered") throw new PublishError("Create an account to publish a run to the public log.");
  const [row] = await db
    .update(generationJobs)
    .set({ publishedAt: published ? sql`now()` : null })
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId), eq(generationJobs.status, "succeeded")))
    .returning({ published: generationJobs.publishedAt });
  if (!row) throw new PublishError("Only your own finished runs can be published.");
  return !!row.published;
}
