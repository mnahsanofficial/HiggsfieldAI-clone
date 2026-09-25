CREATE TYPE "public"."asset_collection" AS ENUM('seed', 'render_library', 'preset_preview');--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"percent_off" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_percent_range" CHECK ("promo_codes"."percent_off" BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "collection" "asset_collection";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "aspect" text;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "assets_collection_idx" ON "assets" USING btree ("collection","topic");--> statement-breakpoint
CREATE INDEX "assets_library_lookup_idx" ON "assets" USING btree ("collection","preset_id","aspect");--> statement-breakpoint
CREATE INDEX "jobs_published_idx" ON "generation_jobs" USING btree ("published_at" DESC NULLS LAST) WHERE "generation_jobs"."published_at" IS NOT NULL;--> statement-breakpoint
-- Backfill: what an asset is stops being encoded in its file name and becomes a column.
UPDATE "assets" SET "collection" = 'seed', "topic" = split_part(replace("url", '/media/seed/', ''), '-', 1)
  WHERE "user_id" IS NULL AND "url" LIKE '/media/seed/%';--> statement-breakpoint
UPDATE "assets" SET "collection" = 'render_library'
  WHERE "user_id" IS NULL AND "url" LIKE '/media/renders/library-%';--> statement-breakpoint
UPDATE "assets" a SET "collection" = 'preset_preview'
  FROM "presets" p WHERE p."preview_asset_id" = a."id";--> statement-breakpoint
UPDATE "assets" SET "aspect" = CASE
    WHEN "width" = "height" THEN '1:1'
    WHEN abs("width"::numeric / "height" - 16.0 / 9) < 0.06 THEN '16:9'
    WHEN abs("height"::numeric / "width" - 16.0 / 9) < 0.06 THEN '9:16'
    WHEN abs("width"::numeric / "height" - 4.0 / 3) < 0.06 THEN '4:3'
    WHEN abs("height"::numeric / "width" - 4.0 / 3) < 0.06 THEN '3:4'
    ELSE NULL END
  WHERE "aspect" IS NULL;
