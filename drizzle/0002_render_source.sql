ALTER TABLE "assets" ADD COLUMN "source_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill from the facts recorded when each render was made.
-- Live renders: the job's input still is the still they were rendered over.
UPDATE "assets" a SET "source_asset_id" = j."input_asset_id"
  FROM "generation_jobs" j
  WHERE a."job_id" = j."id" AND a."kind" = 'video' AND a."source" = 'rendered' AND a."source_asset_id" IS NULL;--> statement-breakpoint
-- Pre-rendered library: one still per aspect (scripts/seed-render-library.ts, STILLS).
UPDATE "assets" a SET "source_asset_id" = s."id"
  FROM "assets" s,
       (VALUES ('16:9', 'cinema-06'), ('9:16', 'street-09'), ('1:1', 'portrait-04')) AS m(aspect, slug)
  WHERE a."collection" = 'render_library' AND a."aspect" = m.aspect
    AND s."collection" = 'seed' AND s."url" LIKE '/media/seed/' || m.slug || '-%';--> statement-breakpoint
-- Preset previews: each preset's chosen still (scripts/seed-preset-previews.ts, SOURCE).
UPDATE "assets" a SET "source_asset_id" = s."id"
  FROM "presets" p, "assets" s,
       (VALUES ('general','cinema-06'), ('slow-push-in','portrait-10'), ('crash-zoom','fantasy-01'),
               ('pull-out-reveal','fantasy-06'), ('pan-left','cinema-03'), ('pan-right','cinema-11'),
               ('tilt-up','street-02'), ('tilt-down','nature-03'), ('arc-pan-left','cinema-01'),
               ('arc-pan-right','fantasy-08'), ('handheld','street-09'), ('handheld-push','cinema-07'),
               ('rack-focus-in','portrait-04'), ('rack-focus-out','product-07')) AS m(preset, slug)
  WHERE p."preview_asset_id" = a."id" AND p."id" = m.preset
    AND s."collection" = 'seed' AND s."url" LIKE '/media/seed/' || m.slug || '-%';--> statement-breakpoint
-- Pre-rendered examples served to users are copies of a library clip: same file, same source.
UPDATE "assets" a SET "source_asset_id" = lib."source_asset_id"
  FROM "assets" lib
  WHERE a."source" = 'sample' AND a."kind" = 'video' AND a."source_asset_id" IS NULL
    AND lib."collection" = 'render_library' AND lib."url" = a."url";
