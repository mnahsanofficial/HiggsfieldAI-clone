# Status

_Rewritten at the end of every branch. Resume from **Next action**._

**Production:** https://higgsfield-ai-clone.vercel.app: green as of the `feat/create-image` merge (the ship script confirms production serves the merge SHA).
**Works end to end now:** a stranger opens `/ai/image`, types a prompt and presses Generate. A guest session is created inline, a real FLUX.1 schnell image lands in History, the header credits drop 100 → 98, and the lightbox shows it labelled MODEL GENERATED. **Step-4 checkpoint:** see the `feat/create-image` PR for the production run.

## Plan (13h budget; build started 2026-09-14 ~20:35 UTC; one usage-limit pause mid `feat/generation-jobs`)

| # | Branch | State |
|---|---|---|
| 0 | `chore/deploy-pipeline`, `chore/db-schema`, `feat/auth` | done (PRs #4–#6) |
| 1 | `feat/credit-ledger` | done (PR #7) |
| 2 | `feat/generation-jobs` | done (PR #8) |
| 3 | `chore/seed-library` | done (PR #9) |
| 4 | `feat/create-image` done ← checkpoint: stranger → guest → prompt → real image → credits down → in History, verified on production | todo |
| 5 | **next** `feat/video-render`: first do a real ffmpeg render on Vercel; assert function duration at runtime, fail and refund if the budget won't fit | todo |
| 6 | `feat/create-video-presets` | todo |
| 7 | `feat/assets-library` | todo |
| 8 | `feat/explore` | todo |
| 9 | `feat/paywall` | todo |
| 10 | `fix/mobile-pass` | todo |
| 11 | README | todo |

## Waiting on the owner
Nothing.

## Next action
Branch `feat/video-render` from `main`. **The first thing, before any preset UI:** a real ffmpeg render inside a Vercel Function on production.
- Add `ffmpeg-static` and a temporary protected route (or the real renderer module) that renders a 5s 720p push-in over a seed still.
- Deploy to a preview and time it; check the bundle includes the binary (`outputFileTracingIncludes`).
- Assert the function's real duration budget at runtime (`maxDuration` / `VERCEL_FUNCTION_MAX_DURATION` or equivalent). If the estimated render time exceeds it, fail the job with a clear reason and refund, never leaving it stuck in processing.
- **If the ffmpeg render fails on Vercel: STOP and tell the owner, and fall back to the simulated provider.**
- Then the renderer: push/pull/pan/tilt/arc/handheld/rack-focus from `presets.motion`, H.264 MP4, upload to `renders/`, `source='rendered'`.

## Facts worth not re-deriving
- **Blob store is PRIVATE.** All Blob access goes through `src/lib/storage.ts` (ESLint blocks `@vercel/blob` elsewhere): `uploadMedia(pathname under generations/|renders/|seed/)` and `readMedia`. Assets store app-relative URLs `/media/<pathname>`, served by `src/app/media/[...path]/route.ts` with an immutable 1-year cache. Locally an explicit `BLOB_READ_WRITE_TOKEN` is used, because the store's OIDC isn't enabled for Development; on Vercel it's OIDC + `BLOB_STORE_ID`.
- Upload cap: `blob_usage` CHECK ≤ 1,500/month; `reserveUpload()` runs before every put; trips are logged once per month to `system_events`.
- Cloudflare: `flux-1-schnell` takes `{prompt, steps}` only (`seed` is rejected, error 5006) and outputs a 1024² JPEG (~750 KB), re-encoded to about 40–110 KB. FLUX.2 klein took 14s and flagged a harmless prompt (error 3030), so it stays inactive. Errors are classified in `providers/cloudflare.ts` (quota/rate → labelled sample at no cost; flagged/bad/provider → refund only).
- Jobs: `src/lib/jobs/service.ts`: `submitImageJob` (validate, price, insert + charge in one tx, max 4 active per user), `runImageJob` (run via `after()` from `/api/jobs`; claim → per-item cache/generate/crop/upload → succeed + insert assets), `failJob`, `cancelJob`, `retryJob`, `sweepStaleJobs` (called on GET `/api/jobs`, throttled 30s). `provider_cache` keys on provider + model + prompt + aspect + batch index.
- Seed library: `scripts/seed-library.ts` (idempotent by slug in `seed/<section>-NN`; stops on quota). Sections: portrait 3:4, cinema 16:9, street 9:16, product 1:1, fantasy 16:9, poster 16:9, nature 4:3. QA with `scripts/dev/seed-contact-sheet.ts`. `src/lib/library/examples.ts`: `addExampleAssets` (6 row copies per new account; an example = user-owned, `source` generated, `job_id` NULL) and `randomSeedImage(section)`.
- Credits are integer tenths; `src/lib/credits/pricing.ts` is shared by UI and server; ledger in `src/lib/credits/ledger.ts`.
- **Verification (all against real services, all clean up after themselves):**
  - `npx tsx --conditions react-server scripts/verify-auth.ts` (18)
  - `scripts/verify-ledger.ts` (11)
  - `scripts/verify-jobs.ts` (24; spends 1 real generation)
  - HTTP as a stranger: `node scripts/dev/api-e2e.mjs <baseUrl>`
- Checkpoint as a stranger through the real UI: `node scripts/dev/ui-image-e2e.mjs <baseUrl> [shotDir] [--mobile]` (10 checks; spends 1 generation).
- Studio UI: `src/components/create/` holds `image-studio`, `image-composer`, `history-grid` (pending/failed/sample/succeeded tiles), `lightbox`, and `use-jobs` (polls while active; `router.refresh()` on terminal state for the header balance). Signed-out Generate calls `POST /api/auth/guest` then retries.
- Screenshots: `node scripts/dev/shoot.mjs docs/screenshots/<branch> <baseUrl> <guest 0|1> "name|390|844|/path" ...`, linked in the PR by commit SHA.
- Ship a branch: `scripts/dev/ship.sh <branch> "<title>" <body.md>` (waits for the Vercel check, fills `__PREVIEW_URL__`, merges with `--merge`, syncs main, waits for production).
- Migrations: `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`), then `npm run db:seed`.
- Vercel: Hobby, fluid on, `functionDefaultTimeout` 300. Previews sit behind Vercel login. `vercel.json` pins the framework.
- A new route's `PageProps`/`RouteContext` types only exist after `npm run build`; run the build before `tsc`.
- Safety rule: don't type passwords into browser forms; test password paths with scripts.
