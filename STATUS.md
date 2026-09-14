# Status

_Rewritten at the end of every branch. Resume from **Next action**._

**Production:** https://higgsfield-ai-clone.vercel.app: green as of the `feat/generation-jobs` merge (the ship script confirms production serves the merge SHA).
**Works end to end now:** one-click guest or email account → credits in header → `POST /api/jobs` generates a real FLUX.1 schnell image (Cloudflare), stores it in private Blob, serves it at `/media/...`; charge on submit, refund on any failure. No image UI yet (next: seed library, then create-image).

## Plan (13h budget; build started 2026-09-14 ~20:35 UTC; one usage-limit pause mid `feat/generation-jobs`)

| # | Branch | State |
|---|---|---|
| 0 | `chore/deploy-pipeline`, `chore/db-schema`, `feat/auth` | done (PRs #4–#6) |
| 1 | `feat/credit-ledger` | done (PR #7) |
| 2 | `feat/generation-jobs` | done |
| 3 | `chore/seed-library` | **next** |
| 4 | `feat/create-image` ← checkpoint: stranger → guest → prompt → real image → credits down → in History, verified on production | todo |
| 5 | `feat/video-render`: first do a real ffmpeg render on Vercel; assert function duration at runtime, fail and refund if the budget won't fit | todo |
| 6 | `feat/create-video-presets` | todo |
| 7 | `feat/assets-library` | todo |
| 8 | `feat/explore` | todo |
| 9 | `feat/paywall` | todo |
| 10 | `fix/mobile-pass` | todo |
| 11 | README | todo |

## Waiting on the owner
Nothing.

## Next action
Branch `chore/seed-library` from `main`:
- `scripts/seed-library.ts` generates about 60–80 images through the real pipeline: Cloudflare → crop → `uploadMedia("seed/...")`. Each becomes an asset with `user_id NULL`, `is_public true`, `source generated`, plus a stable seed key so re-runs skip what exists.
- Prompts are grouped by Explore section (Soul-style portraits, fashion, cinematic stills, product shots, VFX-style scenes, community project posters) and by aspect.
- Watch quota: about 58 Neurons per image and 10,000 a day are shared with live users. Check `blob_usage` stays small (about 80 uploads).
- Guest provisioning: clone a handful of seed assets into each new user's library (rows only, no uploads) so History/Assets aren't empty on first load. Label them as examples.
- Replace the auth card's gradient panel with a seeded image.

## Facts worth not re-deriving
- **Blob store is PRIVATE.** All Blob access goes through `src/lib/storage.ts` (ESLint blocks `@vercel/blob` elsewhere): `uploadMedia(pathname under generations/|renders/|seed/)` and `readMedia`. Assets store app-relative URLs `/media/<pathname>`, served by `src/app/media/[...path]/route.ts` with an immutable 1-year cache. Locally an explicit `BLOB_READ_WRITE_TOKEN` is used, because the store's OIDC isn't enabled for Development; on Vercel it's OIDC + `BLOB_STORE_ID`.
- Upload cap: `blob_usage` CHECK ≤ 1,500/month; `reserveUpload()` runs before every put; trips are logged once per month to `system_events`.
- Cloudflare: `flux-1-schnell` takes `{prompt, steps}` only (`seed` is rejected, error 5006) and outputs a 1024² JPEG (~750 KB), re-encoded to about 40–110 KB. FLUX.2 klein took 14s and flagged a harmless prompt (error 3030), so it stays inactive. Errors are classified in `providers/cloudflare.ts` (quota/rate → labelled sample at no cost; flagged/bad/provider → refund only).
- Jobs: `src/lib/jobs/service.ts`: `submitImageJob` (validate, price, insert + charge in one tx, max 4 active per user), `runImageJob` (run via `after()` from `/api/jobs`; claim → per-item cache/generate/crop/upload → succeed + insert assets), `failJob`, `cancelJob`, `retryJob`, `sweepStaleJobs` (called on GET `/api/jobs`, throttled 30s). `provider_cache` keys on provider + model + prompt + aspect + batch index.
- Credits are integer tenths; `src/lib/credits/pricing.ts` is shared by UI and server; ledger in `src/lib/credits/ledger.ts`.
- **Verification (all against real services, all clean up after themselves):**
  - `npx tsx --conditions react-server scripts/verify-auth.ts` (18)
  - `scripts/verify-ledger.ts` (11)
  - `scripts/verify-jobs.ts` (24; spends 1 real generation)
  - HTTP as a stranger: `node scripts/dev/api-e2e.mjs <baseUrl>`
- Screenshots: `node scripts/dev/shoot.mjs docs/screenshots/<branch> <baseUrl> <guest 0|1> "name|390|844|/path" ...`, linked in the PR by commit SHA.
- Ship a branch: `scripts/dev/ship.sh <branch> "<title>" <body.md>` (waits for the Vercel check, fills `__PREVIEW_URL__`, merges with `--merge`, syncs main, waits for production).
- Migrations: `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`), then `npm run db:seed`.
- Vercel: Hobby, fluid on, `functionDefaultTimeout` 300. Previews sit behind Vercel login. `vercel.json` pins the framework.
- A new route's `PageProps`/`RouteContext` types only exist after `npm run build`; run the build before `tsc`.
- Safety rule: don't type passwords into browser forms; test password paths with scripts.
