-- Postgres won't use a new enum value in the transaction that adds it, and drizzle-kit applies
-- pending migrations in one transaction. So this is idempotent, and was committed on its own
-- before 0005 (which uses the value) ran. A from-scratch database: run `drizzle-kit migrate`
-- once, and again if it stops at 0005.
ALTER TYPE "public"."asset_source" ADD VALUE IF NOT EXISTS 'prerendered' BEFORE 'sample';
