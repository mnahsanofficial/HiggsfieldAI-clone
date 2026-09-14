# Recon notes — higgsfield.ai

Captured 15 Sep 2026, ~00:40–00:51 local, Chrome on macOS, desktop viewport only.
Screenshots in `screenshots/`, numbered in capture order. Full-page PDF captures at the
root of this folder.

**Status: partial but the commercial model is now fully captured.** Signup, onboarding,
navigation, the three create surfaces, pricing and the MCP surface are all documented.
The generation loop itself is not — see "Gaps". Nothing below is inferred; if it isn't in
a capture it's in Gaps.

---

## 1. What the product is

An AI-native creative suite. Not a single model — an aggregator and control layer over
many third-party models, with its own studios, presets and workflow tools on top. The
footer calls it "AI-NATIVE CREATIVE SUITE". Higgsfield Inc., 535 Mission St, 14th floor,
San Francisco.

Three generation verticals — **Image**, **Video**, **Audio** — each with a Features list
and a Models list. Plus studios (Cinema, Marketing, Shorts, Faceless), a Canvas, an agent
(Supercomputer), and an MCP/CLI surface that puts the whole thing inside ChatGPT, Claude
and other clients.

---

## 2. Surfaces observed

### Landing, signed out (`01`, `02`, `19`)
Dark, near-black, with an acid-yellow/lime accent (~`#D4FF3F`) on every primary action.
Top strip promotes a signup discount. Header: logo, Explore / Image / Video / Audio / MCP
/ ChatGPT Plugin `New` / Genjutsu `Free` / Effects `Free` / Cinema Studio / Marketing
Studio / Supercomputer, then Pricing, Enterprise, Login, Sign up.

The full-page capture shows a long stack of content sections, each a titled grid of
generated media with a "View all" pill:

- Hero: four feature cards (AI Motion Designer, Effects, Genjutsu, GPT Image 2.5 Sunburst)
- A signup-discount card beside six model quick-links (Seedance 2.5 `TOP`, Nano Banana Pro,
  Genjutsu `NEW`, MCP & CLI, Cinema Studio 4.0, Supercomputer)
- Full-width partner banner: "Higgsfield MCP with GPT-6 ASTRA"
- VISUAL EFFECTS — masonry grid, "Try for free", "View all presets"
- HIGGSFIELD GENJUTSU — grid, "Start generating" / "Learn more"
- SEEDANCE 2.5 — grid
- EXPLORE THE INSIDE OF EVERY PROJECT — community projects, each card with a title, an
  author ("by Higgsfield Studio") and a `Public` badge. "Explore community"
- SUPERCOMPUTER banner, GPT IMAGE 2 grid, ONE CANVAS banner, MARKETING STUDIO grid,
  SEEDANCE 2.0 grid, PHOTODUMP banner, SOUL CINEMA grid, SOUL 2.0 grid
- EXPLORE MORE AI FEATURES — dense tag cloud of ~40 SEO links
- Footer, lime background, black text: Create / Video Models / Image Models / Studios /
  Soul / Platform / Resources / Company / Community

The repeating unit is **section title + one-line subtitle + media grid + View-all pill**,
reused about ten times with different data.

### Landing vs Explore, signed in (`22` compared with `19`)
The two full-page captures are **near-identical**. Signed in, the page gains the countdown
bar and swaps exactly one card: the "Sign up and get your extra discount" block becomes
"UNLIMITED NANO BANANA PRO WITH PERSONAL 54% OFF" with a live discount timer. Genjutsu's
CTA changes from "Start generating" to "Try free / Learn more". Everything else is the
same content in the same order.

**Implication for the build: one page component, one auth-conditional slot.** Signed-out
and signed-in Explore are not two pages.

### Signup (`01`, `02`)
Modal, not a page. "Welcome to Higgsfield / Sign up and generate for free". Google, Apple,
Microsoft, then Email. A ToS + 18-or-over checkbox appears in the second shot. Behind it, a
tall auto-advancing carousel with progress bars — Seedance 2.0 4K / Nano Banana Pro /
Higgsfield Soul / Cinematic App — each a full-bleed generated image with capability chips
(`4K Resolution`, `2K Quality`, `Prompt Enhancer`) and a tagline.

### Onboarding quiz (`03`–`09`)
Seven-ish steps at `/quiz?rp=%2F`, full-screen, image left, question right, dot progress on
top, back chevron from step 2. Each step has a grey helper line explaining why it asks.

1. How do you plan to use Higgsfield? — Personal / Team (radio)
2. What do you want to achieve? — 6 cards: Just exploring, Automate workflows with
   Supercomputer & MCP/CLI, High-converting marketing, Viral content & UGC videos,
   Cinematic visuals & AI films, Create avatars & product visuals
3. How experienced are you with AI? — Beginner → Expert, each with a sub-line ("Simple,
   guided, one-click presets" → "Manual controls, director tools, MCP"). Helper: "We'll
   adapt the interface complexity to match your expertise level"
4. Which flagship studios? — 6 cards, **multi-select** (checkboxes), CTA "Choose an option"
   disabled until something is picked
5. Which features? — 8 pill chips, multi-select
6. How did you hear about us? — 11 pill chips
7. Which AI frustration should we solve? — 6 cards: Limited generations, Prompting is hard,
   I'm new to this, Hard to build efficient workflows, Inconsistent results, High cost of
   top models

**Observed inconsistency:** step 1 shows seven progress dots, step 2 shows five. The quiz
appears to branch on the first answer without reconciling the indicator.

### Post-signup sequence (`10`, `20`, `11`, `12`)
Four interruptions before the product:
- "Start with Higgsfield Academy" — card stack, Continue
- **GO PREMIUM special offer** (`20`) — see §3
- "Congratulations! You received a personal 54% OFF offer" — countdown, personalised
  promocode, Claim Discount
- On Explore, a "NEW FEATURE — HIGGSFIELD GENJUTSU" modal with "Generate now"

Then a persistent top bar carries the same countdown across every page.

### Navigation mega-menus (`13`, `14`, `15`)
Hovering Image / Video / Audio opens a two-column panel: **Features** (verbs) left,
**Models** (engines) right, each row an icon, a name, a one-line description, some tagged
`TOP` or `NEW`.

- **Image** — 12 features (Create Image, Cinematic Cameras, Canvas, Soul Moodboard, Soul ID
  Character, AI Influencer, Photodump, Relight, Inpaint, Image Upscale, Face Swap,
  Character Swap) · 14 models (Soul 2.0, Soul Cinema, GPT Image 2.5 Sunburst, GPT Image 2.5
  Flare, GPT Image 2, Seedream 5.0 Pro, Nano Banana 2 Lite, Nano Banana Pro, Recraft V4
  Styles, Recraft V4.1, Grok Imagine 2.0, FLUX.2, Z-Image, Topaz)
- **Video** — 17+ features (Create Video, Cinema Studio, Faceless Studio, 3D Jutsu, Shorts
  Studio, Explainer, Canvas, Mixed Media, Edit Video, Reframe, Click to Ad, Change Color
  Palette, Relight, Lipsync Studio, Draw to Video, Draw to Edit, UGC Factory) · 15 models
  (Seedance 2.5, Genjutsu, Gemini Omni Flash 1.1, Kling 3.0, Kling Motion Control, FLUX.3
  Video, MiniMax H3, Wan 3.0, Grok Imagine 1.5, Kling 3.0 Omni Edit, Sora 2, Google Veo 3.1,
  HappyHorse, Minimax Hailuo 2.3, Higgsfield DOP)
- **Audio** — 3 features (Text to Speech, Voice Change, Translate) · 5 models (Seed Audio
  1.0, Eleven v3, Qwen Audio 3.0, MiniMax Speech 2.8 HD, Seed Speech)

Model is a URL parameter: `/ai/image?model=gpt_image_2`, `/ai/video?model=seedance_2_5`.

### Create surfaces (`16`, `17`, `18`)

**Image** (`/ai/image?model=gpt_image_2`) puts everything in a floating bottom composer:
`+` attach · "Describe the scene you imagine" · model chip · aspect (Auto) · quality (High)
· resolution (2K) · a second Auto · batch stepper `− 1/4 +` · **Generate** showing a live
credit cost (6.5). Empty state above: a fan of sample images, "START CREATING WITH
HIGGSFIELD SOUL CINEMA", one instruction line.

**Video** (`/ai/video?model=seedance_2_5`) uses a left sidebar instead:
tabs Create Video / Edit Video / Motion Control → preset card ("GENERAL", Seedance 2.5, with
**Change**) → References / Extend Video toggle → "Add references: Image, Video or Audio" →
prompt textarea with `@Elements` and a sound toggle → Model row → chips `5s`, `16:9`,
`1080p` → Bitrate High → **Generate ৳45**.
Main pane: History / How it works tabs, "MAKE VIDEOS IN ONE CLICK — 250+ presets for camera
control, framing, and high-quality VFX", then a three-step explainer:
**ADD IMAGE → CHOOSE PRESET → GET VIDEO.**

**Audio** (`/audio`) mirrors the video layout: tabs Text to Speech / Voice Change /
Translate → Upload media (up to 3 voices/audios or image) → Script textarea (`@` to
reference attachments) → Model → Batch size → Voice details (0/500) → Advanced settings →
Generate. Main pane has History / How it works and a Filters control.

**Pattern across all three:** a params panel on one side, a History tab in the main pane, a
batch size, a model selector, and a Generate button that prices itself in credits before
you press it.

### MCP / plugin page (`21`)
A standalone marketing-plus-setup page, and the most 8x-relevant surface in the product.

"HIGGSFIELD PLUGIN FOR CHATGPT — Create stunning images and videos without leaving
ChatGPT". A promo bar offers a 3-day trial with 100 credits. Then:

- **A client tab row**: ChatGPT · Claude · Grok Bot · Cursor · Claude Code · OpenClaw ·
  Hermes, separated from MCP · CLI. The page content swaps per client.
- **A two-step numbered setup card**: (1) Add Higgsfield plugin to ChatGPT, with an "Add
  Higgsfield plugin" button; (2) Connect and start creating, with "Start creating".
  Footnote: if you're using Claude Code or Codex, prefer the CLI, plus a GitHub link.
- **HOW DOES MCP WORK?** — tabbed (Video generation / Faceless videos / Marketing / Image
  generation). Left: a mocked ChatGPT conversation showing the prompt and Higgsfield's
  reply with config chips (Seedance 2, 9:16, 8s, Audio). Right: the result clips with view
  and like counts (424k views / 104k likes, 263k / 0).
- **CREATE WITH HIGGSFIELD SKILLS IN CHATGPT** — a searchable sidebar of categories
  (Featured, Marketing, UGC factory, Faceless content factory, Utility, Motion & Design)
  beside a card grid. Each card carries a duration and a `Skill` or `Use case` badge:
  Ad Multiplier 12 min, Editorial Motion Graphics 8 min, Stickman cartoon 5 min, Product
  review UGC 4 min, Faceless Content 4 min.
- **EVERY CREATIVE MODEL, INSIDE CHATGPT** — 8 model cards (Nano Banana Pro, Google Omni
  Flash, Seedance 2.5, Seedream 5.0 Lite, Seedance 2.0, Kling 3, GPT Image 2, Soul 2.0)
- **FAQ accordion**, 5 questions, first expanded
- Tag cloud and the standard footer

---

## 3. Pricing and credits (`20`, `23`)

Two different paywalls, captured in full. This is the single most transferable mechanic in
the product and it's now fully specified.

### The post-onboarding offer modal (`20`) — two tiers, hard sell
"GO PREMIUM WITH PERSONAL UP TO 54% OFF". Personalised promocode shown as applied, a live
countdown (02:58:01), and a Monthly/Annual toggle badged `54% OFF`.

| | PRO `31% OFF` | MAX `43% OFF` `BEST VALUE` |
|---|---|---|
| Positioning | For everyday AI creation | For ambitious AI projects |
| Credits | 600/mo | 1,800/mo |
| Translated to | = 300 Nano Banana Pro generations, ~27 Seedance 2.0 videos | = 900 NBP generations, ~80 Seedance 2.0 videos |
| Credit slider | 600 → 900 | 1,800 → 3,600 → 5,400 |
| Price | ~~$29~~ **$20**/mo billed annually | ~~$79~~ **$45**/mo billed annually |
| Saving | Save $108 vs monthly | Save $408 vs monthly |
| CTA | Select Offer (lime) | Select Offer (magenta) |

Below the price, two comparison blocks:
- **UNLIMITED & FREE GENS** — Nano Banana Pro `No unlimited` on Pro but `2K` `7-day
  unlimited` on Max; Nano Banana 2 and Kling 3.0 `7-day unlimited` on both; "+ 7 unlimited
  & free generation models" expander
- **ACCESS TO SEEDANCE MODELS** — Seedance 2.5 `1080p` Full access, Seedance 2.0 `4K` Full
  access, both tiers
- A ✓/✗ checklist: Unlimited paid parallel generations `New`, Access to Supercomputer,
  Access to all Seedance models, Access to all models & features, Early access to advanced
  AI features, Access to unlimited marketplace, Lowest cost per credit (✗ Pro, ✓ Max)

Footer: "Full Pricing Details" and "Skip this offer" — the dismissal is a plain text button,
deliberately quieter than the CTAs.

### The in-app upgrade modal (`23`) — four tiers
"UPGRADE PLAN TO BUY CREDITS / Choose a higher plan for increased limits and credits
top-up". Same promocode and countdown. Adds two tiers either side of the pair above:

- **BASIC** — $9/mo billed annually, 120 credits/mo (= 60 NBP generations, ~2 Seedance 2.0
  fast videos), "Fixed amount of 120 credits/mo", CTA "Get Basic", note "No difference
  compared to monthly". Its Unlimited & Free Gens block is greyed out entirely, and it
  carries an explicit **"NO ACCESS TO SEEDANCE 2.5 — Available from Pro plan"** panel.
- **FOR TEAMS** `54% OFF` `BEST VALUE` — from $45/seat/mo billed annually, shared workspaces
  and credits, from 4 seats, starting from 1,000 credits per seat per month, CTA "Explore
  Plans". Extra sections: Workspace & Collaboration (shareable elements and Soul ID, shared
  workspace & projects with integrated chats, custom credits amount, unlimited members,
  admin control), Security & Compliance (SOC 2, custom SSO, retain rights to use/edit/publish
  generations, no training clause, indemnification), Personalised Experience (dedicated
  capacity SLA, higher concurrency, priority queue, detailed analytics, automated billing
  invoice, personal Slack support, AI educator, volume discounts).

Small print worth copying for realism: unlimited models and free generations are available
only on higgsfield.ai and **not** via MCP/CLI, Canvas or Supercomputer; prices exclude VAT;
unlimited usage may be speed-adjusted during high traffic; new models roll out gradually.

### What this tells the build
- **Credits are the spine.** They price the Generate button per configuration, they define
  the plan tiers, and they gate model access. Credit balance, per-config cost preview,
  deduction on submit and refund on failure is the whole commercial loop.
- Credits are always **translated into outcomes** ("600 credits = 300 generations or ~27
  videos"), never left abstract.
- **Model access is tier-gated**, and the gate is shown as a feature, not hidden.
- Urgency is structural: a countdown in the top bar, on the Pricing nav item, and inside
  both paywalls.

---

## 4. Things that shape the build

- Credit cost is shown **on the button, before you commit**, and moves with the config.
- **Presets are the differentiator.** "250+ presets for camera control" plus ADD IMAGE →
  CHOOSE PRESET → GET VIDEO says the product sells *direction*, not raw generation.
- **History lives next to creation**, as a tab in the same pane.
- **Nothing is ever empty.** Every surface is dense with generated media on first load.
- **Model is a URL parameter** — the create page is one component parameterised by model.
- Signed-in and signed-out Explore differ by one card.
- **`@` references** appear in both the video prompt and the audio script — a mention system
  for pulling in attached assets.
- The MCP page's skills gallery (category sidebar + card grid + duration + type badge) is a
  second reusable grid component, distinct from the media grid.

---

## 5. Gaps — not captured, do not invent

Still missing. Anything here must be filled in later or flagged explicitly as an assumption:

- **A completed generation.** No prompt was ever submitted: no queue UI, no progress state,
  no timing, no pending card, no completion behaviour.
- **The result view.** Download, share, re-run, variations, lightbox.
- **Assets / library.** The `Assets` nav item was never opened.
- **Credit balance in the header** — the plans are known, the runtime display is not.
- **Any error or failure state.**
- **The preset gallery.** "Change" and "View all presets" were never clicked. Given §4 this
  is the most important remaining gap.
- **Mobile.** Desktop only.
- **Returning sign-in, and sign-out.**

---

## 6. My reactions — TO FILL IN

*(Nazmul: write this yourself before committing. It's where the one improvement over the
original comes from, and it can't be reconstructed from screenshots.)*

- What felt good:
- What felt slow or annoying:
- How many modals stood between signup and generating anything:
- What I expected to find and couldn't:
- The one thing I'd change:
