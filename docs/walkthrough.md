# Walkthrough: Docket, 4:30

The target is 4:30, which leaves 30 seconds of margin under 5:00. The spoken lines come to about 520 words, around 3:30 at a normal pace. The rest is clicking and letting the screen breathe.

**Before you record**
- **Record after 00:00 UTC** so there are free images left today. Home shows the count under Free to start; `/make` shows "N free images left today". If they're gone, use the fallback noted in beat 4.
- **Use a fresh browser window at 1440px**, signed out: a private window is enough. Your first camera move will then be a live render (a guest gets one).
- **Check that rendering is live:** `npx tsx --conditions react-server scripts/ops/render-mode.ts` should print `current render mode: live`. It was live on 2026-09-26.
- **Rehearse on a fixture server** (`IMAGE_PROVIDER=fixture npx next start -p 3100`), not production. A rehearsal on production spends a real image and a real render.
- **Pick your moves.** For the live render, use Slow push-in or Pan right. Arcs and rack focus are always pre-rendered.

| # | Time | Screen | Said |
|---|---|---|---|
| 1 | 0:00–0:15 | Home, top | Opening line (screen) |
| 2 | 0:15–0:45 | You | **Why the design changed** |
| 3 | 0:45–1:05 | Home, scrolling | Home explains (screen) |
| 4 | 1:05–2:00 | `/make`, the handle | **The loop with the handle** |
| 5 | 2:00–2:45 | The run's record, then the list view | **The log as proof the backend is real** |
| 6 | 2:45–3:30 | Free to start, `/credits` | **The limits, told honestly** |
| 7 | 3:30–4:10 | You | **Product judgement** |
| 8 | 4:10–4:30 | The account menu, then the README | Close (screen) |

---

## 1. Open (0:00–0:15) · screen

**Show:** home at 1440px. Let the pair sit for a second, then drag the handle once.

**Say:**
> This is Docket. It makes an image, then moves the camera over it, and every run stays on the record.

## 2. Why the design changed (0:15–0:45) · to camera

**Say:**
> Halfway through, 8x changed the brief: keep the idea and the backend, rebuild the frontend in my own design, and make sure the backend is real, not mock data.
> I asked for three genuinely different directions and chose the run log, because it's the only one where the real data *is* the interface. Every run shows the model that ran, what it cost and any refund, so you can see the backend is honest instead of taking my word for it.
> From the third direction I kept one thing: the handle.

## 3. Home explains (0:45–1:05) · screen

**Show:** scroll slowly through How it works, What's real and Free to start. Stop on **Start making**.

**Say:**
> Home explains, make does, the log remembers. Each step here is one real run from the database: its still, its move, and its receipt.

## 4. The loop with the handle (1:05–2:00) · screen, then to camera

**Click:**
1. **Start making**. Type a short prompt, for example *a lighthouse on black rocks at dusk*, and press **Make the image**. Let the meter drain and the entry print.
2. **Move the camera over this** → **Slow push-in** → **Render the move**. Wait for the take.
3. Drag the handle slowly across, then back.

**Fallback** if today's images are gone: use **Move the camera over a library image**, pick a library still, and skip the first line below.

**Say** while it runs:
> I describe an image and press Make. The meter drains by exactly what it costs, and the run writes itself into my log.
> Now I move the camera over it. This push-in isn't AI video: ffmpeg renders it frame by frame over my still, on the server, while I wait.

**Say**, to camera, with the handle on screen:
> And this is the handle. Drag it and you see exactly what the camera did to the image. That's the whole product in one gesture.

## 5. The log as proof the backend is real (2:00–2:45) · screen, then to camera

**Click:**
1. **Open** on the camera-move run, to reach its record at `/log/<id>`. Point at the model, the cost and the balance after.
2. Go to **Log**, then **List**.

**Say:**
> Every entry has a permanent link. This is the record: the model that ran, what it cost, how long it took, and my balance after.
> In the list view, every credit in and out lines up with the balance after it, straight down. That's the ledger in Postgres, read through the API.
> If a run fails or I stop it, the refund lands here too, with a plus sign and the word "refunded", never just a colour.

## 6. The limits, told honestly (2:45–3:30) · screen, then to camera

**Show:** home's **Free to start**, then `/credits` with the plan cards.

**Say:**
> This runs on free tiers, and it says so. The free image allocation covers fifty-seven images a day for the whole deployment, so each visitor gets five, and the page shows how many are left for everyone.
> Live renders use real server CPU, which I ran out of during the build. So a guest gets one live camera move, and an account gets three. After that you get a pre-rendered example of the same move: labelled, and free.
> Paid plans raise your daily images; they don't pretend to raise the compute. Every one of these numbers is read from the same place the server enforces it, and a test fails if the copy and the cap ever disagree.

## 7. Product judgement (3:30–4:10) · to camera

**Say:**
> Most of the judgement is in what I left out. I didn't fake AI video: it's a real transform, or it's labelled.
> I switched off a second image model after it took fourteen seconds an image and flagged a harmless prompt.
> Home doesn't sell. There are no stats and no testimonials, and every number on it comes from the database.
> The public log is opt-in, and a guest can never publish.
> And because a guest's account lives only in their browser, signing out warns you before you lose your runs.

## 8. Close (4:10–4:30) · screen

**Click:** open the account menu (the balance, top right) and let it sit on **Create an account to keep your runs**. Then cut to the README on GitHub.

**Say:**
> The account menu shows who you are and what you have. The code, the checks I ran against production, and every decision are in the README. Thanks for watching.
