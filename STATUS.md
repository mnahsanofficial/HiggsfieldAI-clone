# Status

_Rewritten at the end of every branch. Resume from **Next action**._

**Production:** https://higgsfield-ai-clone.vercel.app: green, serving the `feat/explore` merge (`2ed9f13`). **`feat/paywall` (PR #15) is NOT merged: every new Vercel build fails, see Waiting on the owner.** (the ship script confirms production serves the merge SHA).

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
| 9 | `feat/paywall` | built and verified locally; PR #15 open, **blocked on Vercel builds** |
| 10 | `fix/mobile-pass` | **next** |
| 11 | README | todo |

## Waiting on the owner
**Vercel builds fail for the project with `BUILD_FAILED: Resource provisioning failed`, before any build step runs.**
- Seen on 2026-09-15 around 05:31–05:40 UTC: two GitHub-triggered previews for PR #15, plus a direct `vercel deploy` from the CLI.
- Production (`2ed9f13`) still serves. The project isn't paused. The Vercel status page shows no incident. There were 31 deployments in 24h.
- The same commit passes `npm run build`, `tsc` and `lint` locally.
- **Likely an account-level Hobby limit or fair-use throttle on builds.** The ffmpeg render tests used real function CPU earlier.
- **Please check:** Vercel dashboard → Usage (build minutes, active CPU, fair-use notices) and the failed deployment's page. Retry, or tell me what it says.
- **Resume:** re-run `scripts/dev/ship.sh feat/paywall "Paywall: upgrade on 402, outcome-priced plans, labelled demo purchase" <body.md>`. The PR already exists; the body is in the PR, so re-save it to a file. Then run `node scripts/dev/ui-paywall-e2e.mjs https://higgsfield-ai-clone.vercel.app "" --mobile`.

## Next action
Branch `fix/mobile-pass` from `main`: one audit at 390px across every shipped surface, on production:
- `/`, `/ai/image`, `/ai/video`, `/assets`, `/credits`, `/pricing`, `/login`, `/signup`, plus the modals (preset gallery, image picker, lightbox, paywall).
- Run all UI e2e scripts with `--mobile` against production; add a shared overflow/tap-target audit script (every button/link ≥ 40px tall on touch, no text under 11px, no horizontal overflow, no clipped fixed elements).
- **Known candidates:**
  - composer and sidebar spacing in landscape phones
  - `/credits` history row wrapping
  - the lightbox aside on short screens
  - iOS safe-area bottom padding for the fixed composer (`env(safe-area-inset-bottom)`)
  - an empty-state error screen (a `not-found` page and an `error.tsx` boundary do not exist yet)
- Keep it to fixes; no new features. Then the one improvement proposal (ask the owner), then README.

## Facts worth not re-deriving
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
