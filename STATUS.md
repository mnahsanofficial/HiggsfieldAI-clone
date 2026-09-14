# Status

_Rewritten at the end of every branch. Resume from **Next action**._

**Production:** https://higgsfield-ai-clone.vercel.app: green (after `feat/credit-ledger` merge)
**Works end to end now:** one-click guest (100 credits) or email sign-up/sign-in, with a credit balance in the header and a ledger history at `/credits`.

## Plan (13h budget; started build 2026-09-14 ~20:35 UTC)

| # | Branch | State |
|---|---|---|
| 0 | `chore/deploy-pipeline`, `chore/db-schema`, `feat/auth` | done (PRs #4–#6) |
| 1 | `feat/credit-ledger` | done |
| 2 | `feat/generation-jobs` | **next** |
| 3 | `chore/seed-library` | todo |
| 4 | `feat/create-image` ← checkpoint: stranger → guest → prompt → real image → credits down → in History, verified on production | todo |
| 5 | `feat/video-render`: first do a real ffmpeg render on Vercel; assert function duration at runtime | todo |
| 6 | `feat/create-video-presets` | todo |
| 7 | `feat/assets-library` | todo |
| 8 | `feat/explore` | todo |
| 9 | `feat/paywall` | todo |
| 10 | `fix/mobile-pass` | todo |
| 11 | README | todo |

## Waiting on the owner
Nothing.

## Next action
Branch `feat/generation-jobs` from `main`:
- Provider interface (`submit` / `getStatus` / `cancel`).
- Cloudflare Workers AI FLUX.1 schnell provider: 1024² output, labelled server-side crop to other aspects. Check FLUX.2 klein params and activate it if they work.
- Simulated provider as the fallback when quota or rate limits hit: fail, refund, serve a labelled sample at no cost.
- Jobs API (submit / poll / cancel / retry), executed with `after()`, plus a sweep driven by polling traffic for stale jobs.
- Single `src/lib/storage.ts` wrapping `@vercel/blob` behind the `blob_usage` counter (DB CHECK caps uploads at 1,500/month; log trips to `system_events`). ESLint `no-restricted-imports` blocks `@vercel/blob` elsewhere.
- `provider_cache` for identical prompt+seed requests.
- Check Blob env on Vercel covers Development (locally `BLOB_READ_WRITE_TOKEN` exists).

## Facts worth not re-deriving
- Credits are integer tenths. Pricing lives in `src/lib/credits/pricing.ts` (shared by UI and server). Ledger functions are in `src/lib/credits/ledger.ts`: `chargeForJob` (conditional debit, same tx as the job insert) and `refundJob` (idempotent, safe to race).
- Verification scripts run against Neon and clean up after themselves: `npx tsx --conditions react-server scripts/verify-auth.ts` / `scripts/verify-ledger.ts`.
- Migrations: `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`), then `npm run db:seed` (idempotent).
- Screenshots: puppeteer-core script in the session scratchpad (`shots/shoot2.mjs`: outDir, baseUrl, guest flag, `name|w|h|path`). Save PNGs to `docs/screenshots/<branch>/` and link them in the PR by commit SHA.
- Vercel: Hobby, fluid compute on, functionDefaultTimeout 300. Preview URLs sit behind Vercel login; production is public. `vercel.json` pins `framework: nextjs`.
- Safety rule: don't type passwords into browser forms; test password paths with scripts.
