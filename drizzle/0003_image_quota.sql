CREATE TABLE "image_usage" (
	"day" text PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_usage_calls_cap" CHECK ("image_usage"."calls" BETWEEN 0 AND 57)
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD COLUMN "client_ip_hash" text;