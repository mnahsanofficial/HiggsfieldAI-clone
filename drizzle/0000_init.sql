CREATE TYPE "public"."asset_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."asset_source" AS ENUM('generated', 'rendered', 'sample', 'upload');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."ledger_reason" AS ENUM('signup_grant', 'plan_grant', 'demo_topup', 'generation_charge', 'generation_refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."model_badge" AS ENUM('top', 'new');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('guest', 'registered');--> statement-breakpoint
CREATE TYPE "public"."vertical" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"job_id" uuid,
	"kind" "asset_kind" NOT NULL,
	"source" "asset_source" NOT NULL,
	"url" text NOT NULL,
	"poster_url" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"duration_ms" integer,
	"model_id" text,
	"preset_id" text,
	"prompt" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blob_usage" (
	"period" text PRIMARY KEY NOT NULL,
	"puts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blob_usage_puts_cap" CHECK ("blob_usage"."puts" BETWEEN 0 AND 1500)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta_tenths" integer NOT NULL,
	"balance_after_tenths" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"job_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_balance_after_non_negative" CHECK ("credit_ledger"."balance_after_tenths" >= 0)
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vertical" "vertical" NOT NULL,
	"model_id" text NOT NULL,
	"preset_id" text,
	"prompt" text NOT NULL,
	"params" jsonb NOT NULL,
	"input_asset_id" uuid,
	"cost_tenths" integer NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"provider_key" text NOT NULL,
	"provider_job_ref" text,
	"provider_state" jsonb,
	"error_code" text,
	"error_message" text,
	"retry_of_job_id" uuid,
	"cancel_requested_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_cost_non_negative" CHECK ("generation_jobs"."cost_tenths" >= 0),
	CONSTRAINT "jobs_progress_range" CHECK ("generation_jobs"."progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vertical" "vertical" NOT NULL,
	"badge" "model_badge",
	"description" text NOT NULL,
	"provider_key" text NOT NULL,
	"provider_model_ref" text NOT NULL,
	"is_model_generated" boolean NOT NULL,
	"min_plan_rank" smallint DEFAULT 0 NOT NULL,
	"capabilities" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"rank" smallint NOT NULL,
	"monthly_credits_tenths" integer NOT NULL,
	"price_monthly_cents" integer NOT NULL,
	"price_annual_cents" integer NOT NULL,
	"outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "plans_rank_unique" UNIQUE("rank")
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"motion" jsonb NOT NULL,
	"preview_asset_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"asset_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "user_kind" NOT NULL,
	"email" text,
	"password_hash" text,
	"display_name" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"credit_balance_tenths" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_balance_non_negative" CHECK ("users"."credit_balance_tenths" >= 0),
	CONSTRAINT "users_registered_has_credentials" CHECK ("users"."kind" = 'guest' OR ("users"."email" IS NOT NULL AND "users"."password_hash" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_preset_id_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_preset_id_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_input_asset_id_assets_id_fk" FOREIGN KEY ("input_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_retry_of_job_id_generation_jobs_id_fk" FOREIGN KEY ("retry_of_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_preview_asset_id_assets_id_fk" FOREIGN KEY ("preview_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_created_idx" ON "assets" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_one_per_job_reason" ON "credit_ledger" USING btree ("job_id","reason") WHERE "credit_ledger"."job_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_user_created_idx" ON "generation_jobs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_active_idx" ON "generation_jobs" USING btree ("status","heartbeat_at") WHERE "generation_jobs"."status" IN ('queued', 'processing');--> statement-breakpoint
CREATE INDEX "system_events_kind_created_idx" ON "system_events" USING btree ("kind","created_at" DESC NULLS LAST);