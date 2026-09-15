# Status

_Rewritten at the end of every branch. Resume from **Next action**._

**Production:** https://higgsfield-ai-clone.vercel.app. Production deploys from `main` succeed again (#16, #17 live); **preview** builds still fail. Originally builds were blocked because the Hobby Fluid Active CPU allowance is exhausted (6h 51m of 4h, from ffmpeg renders). The owner is staying on Hobby. PRs merge after local verification at 390px and 1440px; `main` deploys automatically when builds resume. Retry a deploy at most every 30 min.
**Kill switch (no deploy):** `npx tsx --conditions react-server scripts/ops/render-mode.ts prerendered` (or `live`). Takes effect within ~10s.

**Works end to end now:**
- **Image:** a stranger opens `/ai/image`, prompt → Generate → a real FLUX.1 schnell image in History, credits 100 → 98 (checkpoint passed on production).
- **Video:** a stranger opens `/ai/video`, picks a preset from the gallery (14 real preview renders), adds an image (theirs or the library; or "Animate" from any image's lightbox), Generate → a real ffmpeg-rendered MP4 in History, credits 100 → 70, lightbox labelled RENDERED CAMERA MOVE (passed 10/10 on production at 390px).
- **Explore (`/`):** dense landing, signed out and signed in (auth slots): hero cards, promo card + 6 quick links, 3 banners, 8 media sections (preset preview videos + 68 seed images), a key-art grid, a tag cloud, and a lime footer with a not-affiliated disclaimer. Every one of ~90 links returns 200; tiles open `/ai/image?prompt=` or `/ai/video?preset=`.
- **Paywall:** a 402 in either studio opens "Upgrade plan to buy credits" (recon 23) with the real shortfall. Basic/Pro/Max show credits translated into outcomes and annual prices with the monthly price struck through. Choosing a plan is a labelled demo (no payment): it switches the plan and grants that plan's credits, at most once per plan per user. Also at `/pricing`, and via Get more credits on `/credits`.
- **Assets:** `/assets` shows everything the user made (examples badged), filter by type; lightbox Download / Animate / Reuse (prefills `/ai/image?prompt=`) / Delete (confirm; soft delete).

## Plan (13h budget; build started 2026-09-14 ~20:35 UTC; one usage-limit pause during `feat/generation-jobs`)

| # | Branch | State |
|---|---|---|
| 0 | `chore/deploy-pipeline`, `chore/db-schema`, `feat/auth` | done (PRs #4–#6) |
| 1 | `feat/credit-ledger` | done (PR #7) |
| 2 | `feat/generation-jobs` | done (PR #8) |
| 3 | `chore/seed-library` | done (PR #9) |
| 4 | `feat/create-image` (checkpoint) | done (PR #10); checkpoint passed on production |
| 5 | `feat/video-render` | done (PR #11) |
| 6 | `feat/create-video-presets` | done (PR #12) |
| 7 | `feat/assets-library` | done (PR #13) |
| 8 | `feat/explore` | done (PR #14) |
| 9 | `feat/paywall` | done (PR #15, merged without deploy) |
| 9a | `fix/render-cpu-budget` | done (PR #16, merged without deploy, pending builds) |
| 9b | `feat/paywall-checkout` | done (PR #17, merged without deploy) |
| 9c | `feat/skeletons` | done (PR #18) |
| 9d | `fix/mobile-pass` | done (PR #19) |
| 10 | `chore/readme` | done (PR #20) |
| 11 | `chore/submission-check` | done |

## Waiting on the owner
Nothing blocking. Production deploys from `main` work; preview builds still fail (cause not investigated; production is what's judged).

## Next action (priority order from the owner)
1. ~~CPU reduction + kill switch~~ done.
2. ~~`feat/paywall-checkout`~~ done: demo card form (client-only validation, card fields never sent), promo `AHSAN345` (100% off, server-checked), grant is `demo_topup`, once-per-plan across `plan_grant` + `demo_topup` notes `<Plan> plan%`. e2e sets the guest balance with `scripts/dev/set-balance.ts` (adjustment row) instead of spending renders.
3. ~~`feat/skeletons`~~ done: `SkeletonImg`/`SkeletonVideo` (components/media/skeleton-media.tsx) shimmer in the element's own aspect box until first paint; `loading.tsx` for /, /ai/image, /ai/video, /assets, /credits, /pricing, /login, /signup; lightbox box sized via container query units from asset dims. `ui-skeletons-e2e` holds /media and RSC responses to observe them.
4. ~~`fix/mobile-pass`~~ done: `scripts/dev/mobile-audit.mjs` (16 surfaces at 390: overflow, tap targets ≥32px, controls ≥16px text) all clean; branded 404 + error page; safe-area padding for composer/sheets.
5. ~~README~~ done (`README.md`).
6. ~~Submission readiness check~~ done 2026-09-15 ~07:30 UTC against production `621d257`:
   - api-e2e, ui-explore (390, 90/91 links, no dead links), ui-image (390), ui-video (390; live render + labelled free example), ui-assets (1440), ui-paywall (390, AHSAN345, no card data in any request), mobile-audit (16/16 surfaces)
   - DB-level: verify-auth 19, verify-ledger 11, verify-jobs 24, verify-plans 16, verify-video 19, all pass (run verify-auth with `GUEST_LIMIT_PER_HOUR=30`: `.env.local` sets 1000 and the limit test loops up to it)
   - no secrets in tracked files (incl. `.agent-logs`); `/api/render-test` 404 in production; render mode `live`; squash merge disabled; no stray branches
7. Improvement: skipped. Recon §6 ("My reactions", where the one improvement comes from) is still the owner's to fill, and inventing it would contradict the recon.

**Owner to-dos before submitting:** fill recon §6; record the walkthrough.

## Facts worth not re-deriving
- **Render policy:** `src/lib/render/policy.ts`.
  - Live renders: guests 1, registered 3; counted by `provider_state.served = 'live'`, which must be merged, not overwritten, on success.
  - Arc and rack focus are pre-rendered only. The kill switch is the latest `system_events` row of kind `render_mode` (cached 10s); `VIDEO_RENDER_MODE=prerendered` forces it on deploy.
  - Fallback = job `succeeded` at submit, `cost_tenths 0`, `provider_key 'prerendered'`, asset `source 'sample'` copied from the library `renders/library-<preset>-<16x9|9x16|1x1>-…` (`scripts/seed-render-library.ts`, 42 clips rendered locally).
  - Caps in DB: `camera_motion` 720p/5s only.
  - Renderer: no internal 2× upscale, x264 superfast crf 23.
  - Measured local CPU-s per 720p/5s render: 0.73–0.84 for ordinary moves, arc 1.6, rack focus 1.3 (was 1.66 for push).
- **Video rendering (verified on Vercel):** `src/lib/render/camera.ts` uses ffmpeg zoompan over a 4× upscaled still.
  - Moves: push, pull, pan, tilt, arc (2D pan plus roll, rendered 10% oversize so rotation never shows corners), handheld (summed sines), rack focus (quarter-res blurred layer with an alpha fade over the sharp frame).
  - Binary: `@ffmpeg-installer/ffmpeg` (optional platform package, no postinstall), set as `serverExternalPackages` and traced into `/api/**` via `outputFileTracingIncludes` in `next.config.ts`.
  - Measured on the Vercel function (iad1, 2 vCPU): 5s 720p 3.4–6s; 5s 1080p push 8.1s; 10s 1080p handheld 16.1s, arc 23.6s, rack focus 23s (was 58s before the alpha-fade change). Full HTTP pipeline on a preview: 5s 1080p push done ~10s after submit; 10s 1080p rack focus ~30s. `/media` returned 206 for Range. All under the 300s limit.
- **Render time budget:** `src/lib/render/budget.ts`. `RENDER_FUNCTION_MAX_DURATION_S = 300` mirrors `export const maxDuration = 300` on `/api/jobs` and `/api/jobs/[id]/retry` (`verify-video` fails if they drift; Vercel exposes no limit env var, checked).
  - Before rendering, a pessimistic estimate (900 ms/MP·s ×1.6, motion factors) is compared with the deadline measured from the invocation start. During the render, `renderCameraMove` projects finish time from frame progress and aborts early.
  - Both failures become `render_budget`: fail + refund, never stuck in processing. The stale-job sweep is the last resort.
- **Video jobs:** `src/lib/jobs/video.ts`: `submitVideoJob` (input image must be the user's own or a public seed; price 5s 720p = 30 credits, 5s 1080p = 45) and `runVideoJob(jobId, invokedAtMs)` (uploads the mp4 and poster to `renders/`, asset `kind video`, `source rendered`). `/api/jobs` POST dispatches on `body.vertical`; retry dispatches on the job's vertical.
- `/media/[...path]` supports HTTP Range (206), which iOS Safari needs for `<video>`.
- **Blob store is PRIVATE.** All Blob access goes through `src/lib/storage.ts` (ESLint blocks `@vercel/blob` elsewhere): `uploadMedia` (under `generations/`, `renders/`, `seed/`) and `readMedia`. Assets store `/media/<pathname>`. Locally `BLOB_READ_WRITE_TOKEN` is used (the store's OIDC doesn't allow Development); on Vercel it's OIDC + `BLOB_STORE_ID`.
- Upload cap: `blob_usage` CHECK ≤ 1,500/month; `reserveUpload()` runs before every put; trips are logged once per month to `system_events`.
- Cloudflare: `flux-1-schnell` takes `{prompt, steps}` only (`seed` is rejected, error 5006) → 1024² JPEG, re-encoded to about 40–110 KB. FLUX.2 klein is inactive (14s latency, false flag, error 3030). Quota/rate errors → labelled sample at no cost; flagged/bad/provider errors → refund only.
- Image jobs: `src/lib/jobs/service.ts` (`submitImageJob`, `runImageJob` via `after()`, `failJob`, `cancelJob`, `retryJob`, `sweepStaleJobs` on GET `/api/jobs`, throttled 30s). `provider_cache` keys on provider + model + prompt + aspect + index.
- Seed library: `scripts/seed-library.ts` (68 images; idempotent by slug `seed/<section>-NN`). `src/lib/library/examples.ts` (6 example copies per new account; an example = user-owned + `generated` + no job). QA: `scripts/dev/seed-contact-sheet.ts`.
- Credits are integer tenths; `src/lib/credits/pricing.ts` (shared by UI and server); `src/lib/credits/ledger.ts`.
- Billing: `src/lib/billing/plans.ts` (`listPlans` with outcomes; `switchPlanDemo`, which grants each plan once per user under a row lock) and `/api/plans` (GET list, POST demo switch). `src/components/billing/plan-cards.tsx` and `paywall-modal.tsx`; `/pricing`. Verify: `scripts/verify-plans.ts` (11) and `node scripts/dev/ui-paywall-e2e.mjs <base> [shots] [--mobile]` (7; spends 3 renders). `/api/health` returns the deployed commit (used by ship.sh).
- Explore: `src/app/page.tsx` (queries seeds by section prefix plus preset previews) → `src/components/explore/explore-page.tsx`, `section.tsx` (`MediaSection`, the repeating unit), `auto-video.tsx` (plays only when on screen). `/ai/video?gallery=1` opens the preset gallery. UI e2e with dead-link audit: `node scripts/dev/ui-explore-e2e.mjs <base> [shots] [--mobile]` (10 checks; clipped screenshot bands because Chrome full-page captures wrap past ~16k px).
- Assets: `src/app/assets/page.tsx` plus `src/components/library/asset-library.tsx`; `DELETE /api/assets/[id]` (soft delete). UI e2e: `node scripts/dev/ui-assets-e2e.mjs <base> [shots] [--mobile]` (11 checks incl. image decode). Guest limit per IP: `GUESTS_PER_IP_PER_HOUR` (env `GUEST_LIMIT_PER_HOUR`, default 30; `.env.local` sets 1000 for local test runs). Header NAV: Explore is `desktopOnly` (the logo goes home on phones).
- Studio UI: `src/components/create/` (`image-studio`, `image-composer`, `video-studio`, `preset-gallery` (`PresetGrid` reusable for Explore "View all presets"), `image-picker`, `history-grid` (image + video tiles), `lightbox` (image/video, Animate link → `/ai/video?image=<assetId>`), `use-jobs`). Preset previews: `scripts/seed-preset-previews.ts` (14 renders over chosen seeds, `presets.preview_asset_id`). Video UI e2e: `node scripts/dev/ui-video-e2e.mjs <base> [shots] [--mobile]` (10 checks). Signed-out Generate → `POST /api/auth/guest`, then retry.
- **Verification (real services, all clean up after themselves):** `npx tsx --conditions react-server scripts/verify-{auth,ledger,jobs,video}.ts`. `node scripts/dev/api-e2e.mjs <base>` (HTTP as a stranger). `node scripts/dev/ui-image-e2e.mjs <base> [shots] [--mobile]` (UI checkpoint, 10 checks).
- **Video over HTTP on a protected deployment:** `scripts/dev/video-api-e2e.sh <deployment-url> <image-asset-id> [preset] [res] [dur]`.
- **On-Vercel testing of preview-only routes:** `npx vercel curl "/api/..." --deployment <preview-url> --yes -- -s` (bypasses deployment protection).
- Screenshots: `node scripts/dev/shoot.mjs docs/screenshots/<branch> <base> <guest 0|1> "name|390|844|/path"`, linked in the PR by commit SHA.
- Ship: `scripts/dev/ship.sh <branch> "<title>" <body.md>`. Runs build/tsc/lint locally first, waits for the Vercel check, fills `__PREVIEW_URL__`, merges with `--merge`, syncs main, waits for production.
- Migrations: `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`), then `npm run db:seed`.
- Vercel: Hobby, fluid on, `functionDefaultTimeout` 300. Previews sit behind Vercel login. `vercel.json` pins the framework. `vercel ls` prints its table to stderr.
- A new route's `PageProps`/`RouteContext` types only exist after `npm run build`; run the build before `tsc`.
- Safety rule: don't type passwords into browser forms; test password paths with scripts.
