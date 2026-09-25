import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Credits are stored as integer tenths of a credit everywhere (6.5 credits = 65),
// so the ledger never accumulates floating-point drift.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const userKind = pgEnum("user_kind", ["guest", "registered"]);
export const vertical = pgEnum("vertical", ["image", "video"]);
export const jobStatus = pgEnum("job_status", ["queued", "processing", "succeeded", "failed", "canceled"]);
export const ledgerReason = pgEnum("ledger_reason", [
  "signup_grant",
  "plan_grant",
  "demo_topup",
  "generation_charge",
  "generation_refund",
  "adjustment",
]);
export const assetKind = pgEnum("asset_kind", ["image", "video"]);
// Curated collections this app seeds itself. Everything a user makes has no collection.
export const assetCollection = pgEnum("asset_collection", ["seed", "render_library", "preset_preview"]);
// How an asset came to exist. The UI labels every asset from this, so the
// difference between model output, a rendered transform and a stand-in is never hidden.
export const assetSource = pgEnum("asset_source", [
  "generated", // produced by an image model from the user's prompt
  "rendered", // a real camera-motion render over a still
  "sample", // stand-in served when a provider was unavailable; never charged
  "upload",
]);
export const modelBadge = pgEnum("model_badge", ["top", "new"]);

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // 'free' | 'basic' | 'pro' | 'max'
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  rank: smallint("rank").notNull().unique(),
  monthlyCreditsTenths: integer("monthly_credits_tenths").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull(),
  priceAnnualCents: integer("price_annual_cents").notNull(),
  // Credits translated into outcomes, e.g. ["= 300 image generations", "~ 27 videos"].
  outcomes: jsonb("outcomes").$type<string[]>().notNull().default([]),
});

// Demo promo codes. In the database rather than in code, so what a code does is data the
// API reads, and adding one needs no deploy. No code here takes money: see plans.
export const promoCodes = pgTable(
  "promo_codes",
  {
    code: text("code").primaryKey(), // stored upper-case; lookups upper-case the input
    percentOff: smallint("percent_off").notNull(),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [check("promo_percent_range", sql`${t.percentOff} BETWEEN 1 AND 100`)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: userKind("kind").notNull(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    displayName: text("display_name").notNull(),
    planId: text("plan_id").notNull().default("free").references(() => plans.id),
    // Cached balance; credit_ledger is the source of truth and is written in the same transaction.
    creditBalanceTenths: integer("credit_balance_tenths").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("users_balance_non_negative", sql`${t.creditBalanceTenths} >= 0`),
    check(
      "users_registered_has_credentials",
      sql`${t.kind} = 'guest' OR (${t.email} IS NOT NULL AND ${t.passwordHash} IS NOT NULL)`,
    ),
  ],
);

export const models = pgTable("models", {
  id: text("id").primaryKey(), // URL parameter, e.g. 'flux_1_schnell'
  name: text("name").notNull(),
  vertical: vertical("vertical").notNull(),
  badge: modelBadge("badge"),
  description: text("description").notNull(),
  providerKey: text("provider_key").notNull(), // 'cloudflare' | 'render' | 'simulated'
  providerModelRef: text("provider_model_ref").notNull(),
  // true for diffusion models; false for the camera-motion renderer.
  isModelGenerated: boolean("is_model_generated").notNull(),
  minPlanRank: smallint("min_plan_rank").notNull().default(0),
  capabilities: jsonb("capabilities").$type<ModelCapabilities>().notNull(),
  pricing: jsonb("pricing").$type<ModelPricing>().notNull(),
  active: boolean("active").notNull().default(true),
  sort: smallint("sort").notNull().default(0),
});

export type ModelCapabilities = {
  aspects: string[]; // e.g. ['1:1', '16:9', '9:16']
  resolutions: string[]; // only what the model actually outputs
  durations?: number[]; // seconds, video only
  maxBatch: number;
  acceptsImageInput: boolean;
};

export type ModelPricing = {
  baseTenths: number; // cost of one output at the base configuration
  listMultiplier: number; // struck-through "original" cost = cost * listMultiplier
  resolution?: Record<string, number>;
  duration?: Record<string, number>;
};

export const presets = pgTable("presets", {
  id: text("id").primaryKey(), // slug
  name: text("name").notNull(),
  category: text("category").notNull(), // 'push' | 'pan' | 'arc' | 'handheld' | 'focus'
  description: text("description").notNull(),
  motion: jsonb("motion").$type<PresetMotion>().notNull(),
  previewAssetId: uuid("preview_asset_id").references((): AnyPgColumn => assets.id, { onDelete: "set null" }),
  featured: boolean("featured").notNull().default(false),
  sort: smallint("sort").notNull().default(0),
});

export type PresetMotion = {
  type: "push" | "pull" | "pan" | "tilt" | "arc" | "handheld" | "rack_focus";
  // Normalised parameters interpreted by the renderer (feat/video-render).
  params: Record<string, number | string>;
};

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references((): AnyPgColumn => generationJobs.id, { onDelete: "set null" }),
    kind: assetKind("kind").notNull(),
    source: assetSource("source").notNull(),
    url: text("url").notNull(),
    posterUrl: text("poster_url"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    durationMs: integer("duration_ms"),
    modelId: text("model_id").references(() => models.id),
    presetId: text("preset_id").references((): AnyPgColumn => presets.id),
    prompt: text("prompt"),
    // What this asset IS, as data rather than as a file-naming convention. 'seed' is the
    // public starter library (topic = its section), 'render_library' is the pre-rendered
    // camera-move clips, 'preset_preview' the gallery previews; user content is null.
    collection: assetCollection("collection"),
    topic: text("topic"),
    // Stored, not guessed from width/height, so lookups and the log read the same value
    // the job was submitted with.
    aspect: text("aspect"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("assets_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("assets_collection_idx").on(t.collection, t.topic),
    index("assets_library_lookup_idx").on(t.collection, t.presetId, t.aspect),
  ],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vertical: vertical("vertical").notNull(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    presetId: text("preset_id").references(() => presets.id),
    prompt: text("prompt").notNull(),
    params: jsonb("params").$type<JobParams>().notNull(),
    inputAssetId: uuid("input_asset_id").references((): AnyPgColumn => assets.id, { onDelete: "set null" }),
    costTenths: integer("cost_tenths").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    progress: smallint("progress").notNull().default(0),
    providerKey: text("provider_key").notNull(),
    providerJobRef: text("provider_job_ref"),
    providerState: jsonb("provider_state").$type<Record<string, unknown>>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    retryOfJobId: uuid("retry_of_job_id").references((): AnyPgColumn => generationJobs.id, { onDelete: "set null" }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    // Opt-in publishing for the public log. Null means private, which is the default for
    // every run; only registered accounts can set it (guests never appear publicly).
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Updated while a worker is running; the sweep fails and refunds jobs whose heartbeat went stale.
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    check("jobs_cost_non_negative", sql`${t.costTenths} >= 0`),
    check("jobs_progress_range", sql`${t.progress} BETWEEN 0 AND 100`),
    index("jobs_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("jobs_active_idx").on(t.status, t.heartbeatAt).where(sql`${t.status} IN ('queued', 'processing')`),
    index("jobs_published_idx").on(t.publishedAt.desc()).where(sql`${t.publishedAt} IS NOT NULL`),
  ],
);

export type JobParams = {
  aspect: string;
  resolution: string;
  batchSize: number;
  durationS?: number;
  seed?: number;
};

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deltaTenths: integer("delta_tenths").notNull(),
    balanceAfterTenths: integer("balance_after_tenths").notNull(),
    reason: ledgerReason("reason").notNull(),
    jobId: uuid("job_id").references(() => generationJobs.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    check("ledger_balance_after_non_negative", sql`${t.balanceAfterTenths} >= 0`),
    // One charge and at most one refund per job, even if a poll and the sweep race.
    uniqueIndex("ledger_one_per_job_reason").on(t.jobId, t.reason).where(sql`${t.jobId} IS NOT NULL`),
    index("ledger_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

// Vercel Blob on Hobby includes 2,000 uploads a month and locks the store for 30 days
// if that is exceeded. Every upload must first increment this counter; the CHECK makes
// the 1,500 hard stop a database guarantee rather than an application convention.
export const BLOB_PUTS_MONTHLY_CAP = 1500;
export const blobUsage = pgTable(
  "blob_usage",
  {
    period: text("period").primaryKey(), // 'YYYY-MM' (UTC)
    puts: integer("puts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("blob_usage_puts_cap", sql`${t.puts} BETWEEN 0 AND ${sql.raw(String(BLOB_PUTS_MONTHLY_CAP))}`)],
);

// Operational events worth keeping: cap trips, provider quota exhaustion, rate limits.
export const systemEvents = pgTable(
  "system_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    kind: text("kind").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("system_events_kind_created_idx").on(t.kind, t.createdAt.desc())],
);

// Identical provider+model+prompt+seed+size requests reuse the stored output instead of
// spending shared daily quota again.
export const providerCache = pgTable("provider_cache", {
  key: text("key").primaryKey(), // sha256 of the normalised request
  assetUrl: text("asset_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  hits: integer("hits").notNull().default(0),
  createdAt: createdAt(),
});
