# Status

**Features are frozen as of 2026-09-26.** From here on, only fixes for what's broken, copy corrections, and the submission itself. Anything new goes to the owner as a proposal first.

**Waiting on the owner:** only the two videos. Nothing else is open: no PRs, no drafts.
- The walkthrough script is `docs/walkthrough.md`: 4:28, with beat 2 in the owner's final whys.
- Record when `/make` shows free images left. They reset at 00:00 UTC.

**The domain move (2026-09-26):**
- The app lives only at https://docket-nahsan.vercel.app. higgsfield-ai-clone.vercel.app was retired and returns 404.
- **Share previews:** they took the old host from `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets at build time. One production redeploy picked up the new domain; `og:url` and `og:image` now use it.
- **Nothing else was tied to the old host:**
  - the session cookie is host-only
  - server actions check Origin against Host
  - redirects are path-only
  - there's no sitemap or robots file, and no site-URL env var
- **The new domain works:** a guest session and a real generation (FLUX.1, −2 charged, media 200). The test guest was deleted.
- **Readiness 76/76** on the new domain, at 390 and 1440, with no base URL given: readiness, home and menu now default to the live site.
- **Links updated:** README, STATUS, the walkthrough, `ship.sh` and the GitHub homepage. Historical mentions stay.

**Finished on 2026-09-26, after the owner's interview:**
- **#40:** README, "What I changed from Higgsfield, and why".
  - The whys are the owner's own words, from the interview in the session log.
  - Row 9 keeps the AI-video and studios bullets as drafted, by the owner's choice.
  - Row 2's last column is "Taste." only.
  - "With a real budget, next" holds the owner's three bullets.
  - `recon/notes.md` §6 holds the owner's reactions.
- **#50** (replaces #47, which GitHub closed when #40's branch was deleted): "In 60 seconds" at the very top of the README.
- **#44:** the walkthrough's "What I changed from Higgsfield" beat, in the owner's final whys, retimed to end at 4:28.
- **#49:** preview deployments are off (`vercel.json` deploys `main` only). Every preview had failed at the Neon integration's per-preview provisioning, before building. The README explains the red on older PRs.

**The owner's last pass, done (2026-09-26):**
- **#46:**
  - The hero's camera move plays on load at 390 and 1440, measured.
  - Under reduced motion it holds on its poster with its own "Play the move" button. The old native controls sat under the still's layer. This is fixed in the shared comparison, so log entries get it too.
  - From `lg` up, the headline and the way in sit beside the pair, and the whole pair is on the first screen at 1440×789.
  - The home strip no longer shows a still twice.
- **Production at `67a2799`:** readiness **78/78**; `ui-home-e2e` **38/38** read-only at each width.

**The second reviewer pass (owner, 2026-09-26), items 1–5:**
1. The reference-to-decision story: #40, open for the owner's edit.
2. The showcase is live, not pre-rendered (#41). `scripts/seed-live-moves.ts` published 3 live renders (Slow push-in, Pan right, Crash zoom), charged 30 each and rendered locally. Live runs lead the public log, How it works uses a live charged run, step 2 autoplays (with a play button under reduced motion), and the strip shows live runs and library images.
3. The hero (#42): Start making sits under the subline, above the fold at 1440×789 and 390×844. The pair is capped at 58svh, with a "Drag to compare" hint until the handle moves.
4. Polish (#43):
   - one UTC date format (`lib/time.ts`), with no hydration mismatch
   - out of images, `/make` opens in camera-move mode; disabled batch sizes say why
   - plan outcomes reachable within their caps (Max 600, not 900), tested
   - one live-move line above the cards
   - "Camera move: <preset>" titles with the still's prompt
   - a footer
   - the fixture latency is 3 s
5. The walkthrough segment: #44, open for the owner's edit.

**Production:** https://docket-nahsan.vercel.app, the only domain since 2026-09-26. The old one, higgsfield-ai-clone.vercel.app, was retired and returns 404. It serves Docket at `/` from `main`, and `/api/health` reports the deployed commit. Hobby plan: production deploys from `main`; preview deployments are off (#49).
**Kill switch (no deploy):** `npx tsx --conditions react-server scripts/ops/render-mode.ts prerendered` (or `live`). Takes effect within ~10 s. It's `live` as of 2026-09-26.

**What a stranger can do, end to end, on production:**
- **Home** explains Docket, with the real pair and handle; how it works as three real artifacts from one published run; what's real; free to start, from the enforced values; **Start making**; and a four-entry public strip.
- **`/make`** makes an image (FLUX.1 [schnell] on Cloudflare Workers AI), then moves the camera over it (ffmpeg): live for the first render (1 as a guest, 3 with an account), then pre-rendered examples, labelled and free.
- **`/log`** is your runs and every credit movement, with the balance after each. `/log/<id>` is a run's permanent record, with share previews when it's public. `/log?scope=public` is everyone's published runs plus the library.
- **`/credits`** shows plans that state their limits beside their credits, and the labelled demo checkout (`AHSAN345` takes 100% off).
- **The account menu**, top right: who you are, balance, your log, sign out. A guest's sign-out warns first.

**Last verification (2026-09-26, production at `f3949e1`, 390px and 1440px):** readiness **76/76** (fresh browser, signed out). With images left today (57 of 57), the two out-of-images checks on `/make` don't apply; on a day they're gone it's 78. Earlier on 2026-09-26, at `67a2799`: `ui-home-e2e` **38/38** read-only at each width. At `311605f`: `ui-menu-e2e` **20/20** (the guest part). Locally, on a fixture server: make 28, credits 22, home 39, log 12 and menu 22, all passing at both widths; `verify-limits` 16, `verify-log` 21.

**Owner to-dos, not blocking:**
- Done 2026-09-26: the project, repo and domain all carry the Docket name now (`docket-nahsan`, https://docket-nahsan.vercel.app).
- Record the walkthrough from [`docs/walkthrough.md`](docs/walkthrough.md), after 00:00 UTC so free images are left.

## Plan: redesign (Docket), order changed 2026-09-25: switch-over before README, both this session

The brief changed on 2026-09-25: keep the idea and the backend, rebuild the frontend as my own
design, and make sure nothing reads as mock data. Direction 2 ("the run log") was chosen, named
**Docket**, with the drag-to-compare handle taken from Direction 3 (user-dragged only).

| # | Branch | State |
|---|---|---|
| 1 | `fix/backend-audit` | done (PR #22) |
| 2 | `feat/design-system` | done (PR #23) |
| 3 | `feat/make` create flow (image → camera move) | done (PR #24) |
| 4 | `feat/log` library and history, `/log/<id>` permalinks, publish | done |
| 4a | `feat/image-quota` (owner: free tier, 5/visitor/day, show the real count) | done (PR #26) |
| 5 | `feat/home` (Docket home at `/next`) | done (PR #27) |
| 6 | `feat/credits-auth` (lean restyle; AHSAN345 keeps working) | done (PR #28) |
| 7 | done: switch-over: Docket at `/`, legacy deleted, old paths redirected, no Higgsfield identity | todo |
| 8 | `chore/readme-docket`: README rewrite + readiness check on production | done |

Owner's changes to the chosen direction, to hold to while building:
- media leads, the receipt supports: the image/video is the largest thing in an entry, the
  model/cost/timing line sits quietly beneath it; media view is the default, list is the toggle
- credits in/out never rely on colour alone: every amount carries a sign and a word
  ("charged", "refunded", "free")
- the public log is opt-in only: seed library + explicitly published runs; guests never
- every entry has a permalink `/log/<id>`, openable signed-out when published
- sentence case labels (no all-caps), and mono only where alignment genuinely needs it
- an empty log is an invitation: one line, the make box, and the public log beneath

Earlier build (the clone) is PRs #1–#21; production has been green throughout.

## Reviewer-pass fixes (owner tested the live site cold)
1. `fix/honest-limits` (PR #31): `plans.images_per_day` (free 5, basic 10, pro 15, max 20; CHECK ≤ 57) is the one source for the cap, the cards and the starter (`lib/billing/limits.ts`); network cap = highest plan cap; live renders unchanged per plan. Cards/starter state the limits beside the credits; the "N camera moves" outcome is gone. `scripts/verify-limits.ts` ties copy to enforcement. DB connect timeout 10 s → 30 s (laptop connects measured 5–20 s).
2. `feat/home-headline-pair` (PR #32): one-line h1 in the first HTML (home has no loading boundary); a real still-and-take pair with the handle (`lib/docket/home-pair.ts`, a featured live-renderable move's preview over its still); out of images → the camera-move action leads, quota note second. `scripts/seed-public-moves.ts` published 4 pre-rendered moves from a library account that can't sign in (`library@docket.invalid`).
3. `feat/share-previews`: `/` and every public `/log/<id>` have og:title, og:description and a generated 1200×630 image (`lib/og/card.tsx`; the run's image, or a take's poster frame). Private runs: no og, noindex, image route 404. Titles cut at a word with an ellipsis (`lib/text.ts`). Readiness checks all of it.
4. `fix/preset-names-sentence-case`: the 13 Title Case preset names and the video model ("Camera motion") are in sentence case, reseeded; `verify-log` fails on a Title Case preset. Still picker checked, left as-is: each button carries `aria-label` = the prompt, the image inside is `alt=""`, so the prompt is read once. Two stale `ui-make-e2e` checks fixed on the way: the library check assumed library entries lead the public log (published runs do since #32), and the pending check slept past the 1.5 s fixture on mobile (now polls).
5. `chore/readiness-after-fixes`: readiness on production at 390px and 1440px, **76/76**; screenshots refreshed. The reviewer-pass list is done.

## Last changes before the feature freeze (owner, 2026-09-26): done
1. `feat/home-explains` (PR #36): home explains (headline + who it's for; real pair; how it works as three real artifacts from one published run; what's real, linked to a real record; free to start from the enforced values; one primary action; a four-entry public strip). The public log page is `/log?scope=public` (`listPublicLogPage`, stable order, offset paging; API `?offset=`). Home e2e rewritten, 24/24 at 390 and 1440; `verify-log` 20/20.
2. `feat/account-menu` (PR #37): the balance is a menu button (who you are, Balance → /credits, Your log, Sign out). Guests: the menu leads with creating an account; sign-out confirms, saying the runs become unreachable for good. On phones with a session, the nav drops its Credits link (the menu's Balance goes there) so a four-digit balance fits. `ui-menu-e2e` 22/22 at 390 and 1440.
3. `fix/home-tap-targets` (PR #38): two record links on home were under 32px (caught by readiness on production). The home e2e runs read-only on production; the menu e2e's registered part runs locally only.
4. `chore/freeze-docket`: readiness, home and menu against production; README screenshots, What to click first and the Live link checked; this STATUS; `docs/walkthrough.md`.

## Where things stand (2026-09-25)
- **`/` serves Docket on production** since 14:45 UTC (commit `8a46afb`). Readiness against production: **76/76** on 2026-09-26 after the reviewer-pass fixes (#31–#34), including share previews and word-boundary titles (fresh browser, no cookies, signed out, 390 and 1440; `docs/screenshots/readiness-production/`).
- README rewritten for Docket (PR #30); the three directions as offered are in `docs/design-directions.md`.
- Owner to-dos, not blocking:
  - The Vercel project and domain (`higgsfield-ai-clone.vercel.app`) and the GitHub repo still carry the old name (dashboard actions). Old links keep working through the redirects.
  - The walkthrough beat sheet from 2026-09-15 describes the clone; it needs redoing for Docket.
- The daily image allowance resets at 00:00 UTC; until then `/make` truthfully says none are left and points to camera moves.

## Switch-over (PR #29)
- Docket is the app: routes at the app root (`/`, `/make`, `/log`, `/log/<id>`, `/credits`, `/sign-in`, `/sign-up`, `/style`). Home lives in `app/(home)` and the log list in `app/log/(list)` so their loading boundaries don't stream other routes before `notFound()` can set 404.
- The root layout is Docket's shell (header, skip link, `.docket` on body). The legacy UI, its components and its e2e scripts are deleted, not hidden. `/api/assets` is gone (Docket deletes through `/api/log/<id>`).
- Redirects in `next.config.ts`: `/ai/image`, `/ai/video` (with `image`/`preset`), `/ai/*`, `/assets`, `/pricing`, `/login`, `/signup`, `/explore`. Query strings carry over.
- Identity: no Higgsfield name, copy, colours (lime removed from tokens), components or nav in the running app. Session cookie is `docket_session`; the old `hf_session` is still read so no guest's runs are stranded, and it's replaced on the next sign-in. `package.json` name is `docket`. New `app/icon.svg`.
- `asset_source` gained `prerendered` (0004, committed on its own because Postgres won't use a new enum value in the transaction that adds it); video examples moved to it (0005). Legacy image stand-ins stay `sample`.
- `db/index.ts`: pool `error` listener (an idle connection dropping was an uncaught exception that could kill the process), idle and connect timeouts.
- Readiness: `node scripts/dev/readiness.mjs <base> [dir]` (fresh browser, signed out, 390 and 1440, makes nothing; safe on production).

## Credits and auth (PR #28)
- `/next/credits` (`components/docket/credits/*`): balance and what it buys, account (guest → create an account; registered → sign out), plans from `listPlans()` (now with `imageCount`/`videoCount`), demo checkout in a Sheet. Card helpers live in `lib/billing/card-format.ts`. AHSAN345 unchanged; once-per-plan unchanged.
- `/sign-in`, `/sign-up` (`components/docket/auth/auth-form.tsx`) on the existing server actions; sign-out now lands on Docket's home.
- `Sheet` fix: a queued `close` event from our own `close()` could close a sheet reopened right after. Only a browser-made close of a sheet we still want open counts now.
- `/log` list view shows credit movements even before your first run.
- Plan taglines were Higgsfield's wording (recon capture 23); replaced in the catalogue and reseeded.
- e2e: `node scripts/dev/ui-credits-e2e.mjs <base> [dir] [--mobile]` (18 checks; no images made).
- Local runs occasionally fail on transient Neon connection errors from this laptop ("Authentication timed out"); the page shows its error state. Not seen on Vercel.

## Home (PR #27)
- `/next` (`app/(docket)/next`, `components/docket/home/home-page.tsx`): one line, the make box with the real allowance and price, then your latest runs or the public log, media first with a list toggle. Making from home lands the run on `/make`. Moves to `/` at switch-over.
- Privacy fix in the read model: `balanceAfterTenths` is null on every copy of a run but the owner's (it leaked through `/api/log?scope=public` before). `verify-log` asserts it.
- e2e: `node scripts/dev/ui-home-e2e.mjs <base> [dir] [--mobile]` (7 checks, fixture server only).

## Image allowance (PR #26)
Owner's decision: **stay on the free tier.** Cloudflare gives 10,000 neurons/day; FLUX.1 schnell at 1024² and 4 steps costs 172.8 neurons (4 tiles × 4.8 + 4 tiles × 4 steps × 9.6), so **57 images/day**. That matches the 58th call on 2026-09-25 being refused.
- `image_usage` (day, calls, `CHECK calls BETWEEN 0 AND 57`); `reserveImageCall()` before every real provider call; a real Cloudflare quota error sets the day to 57 (`markImagesExhausted`).
- Per visitor 5/day (per account), per network 20/day (per IP hash on `generation_jobs.client_ip_hash`), checked at submit with the user row locked, before any charge (`DailyLimitError` → 429 `daily_limit`).
- `/make` shows the real numbers ("N free images left today on this deployment, of 57. You can make N more."); `/api/log` returns `quota`.
- **Tests never spend the allowance.** `IMAGE_PROVIDER=fixture` (honoured only off Vercel) swaps in `providers/fixture.ts` (a seed image, 1.5 s latency, jobs recorded `provider_key 'test-fixture'`, site check skipped, page says "Test mode"). `verify-jobs` forces it; `ui-make-e2e` refuses to run unless the page says Test mode. Start the test server with `IMAGE_PROVIDER=fixture npx next start -p 3100`.

## Log (PR #25)
- `/log` (`app/(docket)/log/(list)`): media view by default, list view (`?view=list`) interleaving runs with credit events and the balance after each; filters; "Show older runs". Signed out it's an invitation plus the public log.
- `/log/<id>` (`app/(docket)/log/[id]`, `components/docket/log/record.tsx`): owner sees everything including balance after; others only if published (or a library item), else a real **404** with the same text for private and missing. The list page is in its own `(list)` group so its loading boundary doesn't stream the permalink before `notFound()`.
- Publishing: `PublishControl`, registered only; guests see "Create an account to publish". `DELETE /api/log/<id>` soft-deletes outputs and unpublishes in one transaction.
- Test helpers: `scripts/dev/test-account.ts create|delete` (registered account + session token, no password typing), `scripts/dev/fixture-run.ts <userId>`.
- e2e: `node scripts/dev/ui-log-e2e.mjs <base> [dir] [--mobile]` (12 checks, no provider calls).

## Create flow (PR #24)
- `/make` (`src/app/(docket)/make`, `components/docket/make/*`, data in `lib/docket/make-data.ts`). `?mode=move&still=<assetId>&move=<presetId>&prompt=` hand off into the loop.
- The commit: the meter drains (balance frozen until the drain ends) while the new entry prints in (`.entry-new` clip-path, 700ms).
- `useLog` polls `/api/log?scope=mine` only while something runs; it applies only the newest response (out-of-order responses briefly resurrected finished runs with a Cancel that 409'd, which the e2e caught). `/api/log` now runs the stale-job sweep.
- Entry (`components/docket/log/entry.tsx`): media leads; video uses the compare handle against `renderedFrom` ("Library still" for examples); receipt line; Cancel / Try again / Move the camera over this / Download.
- ROUTES points unbuilt pages at live ones: home and log to `/make`, credits and sign-in to the old pages. Flip each as its branch lands.
- e2e: `node scripts/dev/ui-make-e2e.mjs <base> [dir] [--mobile]` (20 checks; `E2E_LIVE=1` adds a live render: LOCAL ONLY, never against Vercel).

## Design system (PR #23)
- Tokens in `globals.css` `@theme` (`paper field line ink muted posted charged live`), `.docket` scope with the type scale (`t-display t-title t-body t-meta t-label`), focus ring, reduced motion.
- Components: `src/components/ui/` (`button`, `field`, `segmented`, `amount`, `tag`, `cost-meter`, `sheet`, `compare`, `use-reduced-motion`); Docket shell `src/components/docket/` (`header`, `routes`).
- Route groups: the old UI lives in `src/app/(legacy)` (removed at switch-over); Docket in `src/app/(docket)`. `ROUTES` in `components/docket/routes.ts`: `/make`, `/log`, `/log/<id>`, `/sign-in`, `/sign-up` are final; home and credits sit at `/next`, `/next/credits` until switch-over.
- Font: Public Sans variable, self-hosted (`src/app/fonts`). **No monospaced face**: tabular figures measured at 0.00px spread across digits.
- `assets.source_asset_id`: the still a video was actually rendered over (a pre-rendered example's is a library still). The log exposes it as `renderedFrom`; the compare handle must use it, never the user's pick.
- `/style` shows every component; `node scripts/dev/design-system-check.mjs <base> [dir] [--mobile]` audits it (11 checks).

## Backend audit (PR #22)

| What could read as mock | Fix |
|---|---|
| Image sample fallback on quota | Removed. The job fails, refunds, and says the daily free limit is used up and when it resets (00:00 UTC) |
| Seed/library identity encoded in file names | `assets.collection`, `assets.topic`, `assets.aspect` columns + backfill; all lookups by column |
| Promo code in a source map | `promo_codes` table, seeded; `AHSAN345` unchanged for users |
| No publish model | `generation_jobs.published_at`, opt-in, registered only |
| Nothing to read a run from | `src/lib/log/entries.ts` + `GET /api/log`, `GET /api/log/[id]`, `POST /api/log/[id]/publish` |
| Typed-in credit numbers in copy | Derived from `STARTER_CREDITS_TENTHS` and DB pricing |
| Hardcoded preset categories | Derived from `presets.category` |
| Explore's editorial sections | Not migrated: the new IA has no editorial sections. Home reads `/api/log`; the file goes at switch-over |
| `assetSource='sample'` now means only "pre-rendered example" | Rename deferred to switch-over: renaming the enum while the old UI is live would label a pre-rendered example as a live render |

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
