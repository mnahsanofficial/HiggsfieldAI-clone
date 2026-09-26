# Walkthrough: Docket, 4:30

The target is 4:30, which leaves 30 seconds of margin under 5:00. The spoken lines come to about 535 words, around 3:35 at a normal pace. The rest is clicking and letting the screen breathe.

**Before you record**
- **Record after 00:00 UTC** so there are free images left today. `/make` shows "N free images left today". If they're gone, home and `/make` lead with the camera move; use the fallback noted in beat 5.
- **Use a fresh browser window at 1440px** on https://docket-nahsan.vercel.app, signed out: a private window is enough. Your first camera move will then be a live render (a guest gets one).
- **Check that rendering is live:** `npx tsx --conditions react-server scripts/ops/render-mode.ts` should print `current render mode: live`.
- **Rehearse on a fixture server** (`IMAGE_PROVIDER=fixture npx next start -p 3100`), not production. A rehearsal on production spends a real image and a real render.
- **Pick your moves.** For the live render, use Slow push-in or Pan right. Arcs and rack focus are always pre-rendered.
- **For beat 2, have the captures ready:** the README section "What I changed from Higgsfield, and why", or `recon/screenshots/03`, `11`, `20` and `17` in tabs beside Docket.

| # | Time | Screen | Said |
|---|---|---|---|
| 1 | 0:00–0:12 | Home, top | Opening line (screen) |
| 2 | 0:12–1:07 | Recon captures beside Docket | **What I changed from Higgsfield** |
| 3 | 1:07–1:32 | You | **Why the design changed** |
| 4 | 1:32–1:47 | Home, scrolling | Home explains (screen) |
| 5 | 1:47–2:40 | `/make`, the handle | **The loop with the handle** |
| 6 | 2:40–3:15 | The run's record, then the list view | **The log as proof the backend is real** |
| 7 | 3:15–3:55 | `/credits` | **The limits, told honestly** |
| 8 | 3:55–4:15 | You | **Product judgement** |
| 9 | 4:15–4:28 | The account menu, then the README | Close (screen) |

---

## 1. Open (0:00–0:12) · screen

**Show:** home at 1440px. **Start making** is on the first screen. Drag the handle once and let the hint disappear.

**Say:**
> This is Docket. It makes an image, then moves the camera over it, and every run stays on the record.

## 2. What I changed from Higgsfield (0:12–1:07) · screen, then to camera

The reasons below are your final whys from the README table (rows 1, 2 and 6), word for word.

**Show, one pair per line:**
1. The quiz and discount captures (`03`, `11`) → Docket's `/make` with the prompt box empty.
2. The premium offer with its countdown (`20`) → Docket's cost meter under **Make the image**.
3. The History tab (`17`) → Docket's log in list view.

**Say:**
> Higgsfield was my reference, not my blueprint. Three things I changed.
> Getting started. Before you make anything, Higgsfield asks seven quiz questions, then shows four more screens. The quiz and offers felt like selling before I'd tried anything. I wanted to try before signing up, so in Docket you make something first and decide about an account later.
> Pricing. Higgsfield runs a countdown on every page. The countdown and the discounts felt like selling, the same as the quiz. In Docket the price on the button is the real price, and the limits are stated plainly.
> And Higgsfield keeps History and Assets apart. 8x asked for a backend that's real, not mock data. Putting what you made and what it cost in one log lets you see that, because the charge and the refund sit right next to the image.

## 3. Why the design changed (1:07–1:32) · to camera

**Say:**
> When 8x changed the brief, I kept the backend and rebuilt the frontend as my own design. I chose the run log because it's the only direction where the real data *is* the interface: every run shows the model, the cost and any refund. From another direction I kept one thing: the handle.

## 4. Home explains (1:32–1:47) · screen

**Show:** scroll through How it works; let step 2's move play. Then scroll back up to **Start making**.

**Say:**
> Home explains, make does, the log remembers. Each step here is one real run, rendered live: its still, its move, and its receipt.

## 5. The loop with the handle (1:47–2:40) · screen, then to camera

**Click:**
1. **Start making**. Type a short prompt, for example *a lighthouse on black rocks at dusk*, and press **Make the image**. Let the meter drain and the entry print.
2. **Move the camera over this** → **Slow push-in** → **Render the move**. Wait for the take.
3. Drag the handle slowly across, then back.

**Fallback** if today's images are gone: `/make` opens on **Camera move**; pick a library still and skip the first line below.

**Say** while it runs:
> I describe an image and press Make. The meter drains by exactly what it costs, and the run writes itself into my log.
> Now I move the camera over it. This push-in isn't AI video: ffmpeg renders it frame by frame over my still, on the server, while I wait.

**Say**, to camera, with the handle on screen:
> And this is the handle. Drag it and you see exactly what the camera did to the image. That's the whole product in one gesture.

## 6. The log as proof the backend is real (2:40–3:15) · screen, then to camera

**Click:**
1. **Open** on the camera-move run, to reach its record at `/log/<id>`. Point at the model, the cost and the balance after.
2. Go to **Log**, then **List**.

**Say:**
> Every entry has a permanent link. This is the record: the model that ran, what it cost, how long it took, and my balance after.
> In the list view, every credit in and out lines up with the balance after it. That's the ledger in Postgres, read through the API. Refunds land here too, with a plus sign and a word, never just a colour.

## 7. The limits, told honestly (3:15–3:55) · screen, then to camera

**Show:** `/credits`: the line above the plans, then the Max card.

**Say:**
> This runs on free tiers, and it says so. Fifty-seven images a day for the whole deployment, five per visitor, counted down on the page for everyone.
> Live renders are real server CPU, which I ran out of during the build. So a guest gets one and an account gets three. After that, a pre-rendered example: labelled, and free.
> Every number is read from where the server enforces it, and a test fails if a card promises more than its caps allow.

## 8. Product judgement (3:55–4:15) · to camera

**Say:**
> Most of the judgement is in what I left out. No faked AI video: a real transform, or a label.
> I switched off a second image model after fourteen seconds an image and a false moderation flag.
> The public log is opt-in, and a guest's sign-out warns you before you lose your runs.

## 9. Close (4:15–4:28) · screen

**Click:** open the account menu (the balance, top right) and let it sit on **Create an account to keep your runs**. Then cut to the README on GitHub; the footer's **Source on GitHub** link goes there.

**Say:**
> The code, the checks I ran against production, and every decision, including what I changed from Higgsfield, are in the README. Thanks for watching.
