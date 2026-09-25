# The three design directions

These are the directions offered on 2026-09-25, after 8x changed the brief from "rebuild Higgsfield" to "keep your idea and your backend, and rebuild the frontend with your own layout and visual design". They're reproduced as offered. The owner chose **Direction 2, the run log**, named it **Docket**, and took **the handle** from Direction 3. The reasons, in the owner's words, are in the [README's design section](../README.md#design).

The brief for the directions:
- They had to differ in layout and information architecture, not only palette.
- At least one had to come from the product's own vocabulary (shots, framing, takes, contact sheets), and one from the owner's direction.
- Nothing of Higgsfield's identity could survive.
- None of the patterns that mark a design as generated were allowed.

---

## Direction 1: Contact sheet

**Idea.** The app is a working bench for a photographer who also directs: you expose a frame, then you print takes of camera moves over that frame, and everything you've ever made reads as a numbered contact sheet. Nothing is a "card"; things are frames, takes and sheets, with the edge printing and frame numbers that come with them.

**Names:** Gate, Slate, Rebate

**Palette**
| Name | Hex | Role |
|---|---|---|
| Sheet | `#E8E6E1` | page ground, a printed-paper grey (not cream) |
| Graphite | `#1A1A18` | all text, rules, the UI's only "ink" |
| Silver | `#9B9A94` | secondary text, inactive strip frames |
| Gate black | `#0B0B0B` | the surround every image and video sits on, so colour reads true |
| Grease blue | `#1B3FCB` | the china-marker mark: selection, the circled take, primary action |
| Marker red | `#D62828` | only for limits and destructive confirm |

**Type.**
- **Archivo** for everything spoken: UI, headings, prompt text. It's a signage grotesque, the voice of camera plates and equipment labels.
- **IBM Plex Mono** for everything counted: frame numbers, timecode, durations, credit balances, prices.

The split is a rule, not decoration: if it's a number that must line up, it's mono; if it's language, it's Archivo.

**The one memorable thing: the strip.** A real film strip runs along the bottom of the create screen, with sprocket edges and frame numbers, and each take is a frame in it.
- It's the navigation, the history and the progress indicator at once.
- A rendering take sits in the strip filling up, and a finished take snaps into place.
- The selected take is circled in grease blue.

Everything else on the page is flat grey and quiet.

**Create, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ GATE          shoot    sheet    stock                    stock 70.0  ▸   │
├────────────────────┬─────────────────────────────────────────────────────┤
│ FRAME              │                                                     │
│ ┌────────────────┐ │        ┌───────────────────────────────┐            │
│ │ describe the   │ │        │                               │            │
│ │ frame…         │ │        │        frame on black         │            │
│ └────────────────┘ │        │        true aspect, no crop    │            │
│ aspect  1:1 16:9   │        │                               │            │
│ 9:16  4:3  3:4     │        └───────────────────────────────┘            │
│ flux.1 schnell     │         014   1024×1024   flux.1 schnell   2.0      │
│ ┌────────────────┐ │                                                     │
│ │ expose  2.0    │ │   MOVE                                              │
│ └────────────────┘ │   push in │ pan L │ tilt up │ handheld │ arc*       │
│                    │   5s 720p                    take costs 30.0        │
│                    │   ┌──────────────┐                                  │
│                    │   │ print take   │                                  │
│                    │   └──────────────┘                                  │
├────────────────────┴─────────────────────────────────────────────────────┤
│ ▚ 011 ▞│▚ 012 ▞│▚ 013 ▞│▚(014)▞│▚ 015 ▞│▚ 016 ▞│▚ 017 ▞│▚ 018 ▞│▚ 019 ▞ │
│  frame    take     take   FRAME    take   rendering 40%   take    take   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Create, 390px**
```
┌──────────────────────────────┐
│ GATE               70.0  ≡   │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │                        │  │
│  │    frame on black      │  │
│  │                        │  │
│  └────────────────────────┘  │
│  014  1024×1024  2.0         │
├──────────────────────────────┤
│ ▚011▞│▚012▞│▚(014)▞│▚015▞ →  │   ← strip scrolls, thumb-sized
├──────────────────────────────┤
│ frame ▸        move          │   ← two modes, not two pages
│ ┌──────────────────────────┐ │
│ │ describe the frame…      │ │
│ └──────────────────────────┘ │
│ 1:1  16:9  9:16  4:3  3:4    │
│ ┌──────────────────────────┐ │
│ │ expose            2.0    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Home, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ GATE          shoot    sheet    stock                        sign in     │
├──────────────────────────────────────────────────────────────────────────┤
│  Make a frame. Then decide how the camera moves over it.                 │
│  ┌────────────────────────────────────────────────┐   ┌───────────────┐  │
│  │ describe a frame…                              │   │ expose  2.0   │  │
│  └────────────────────────────────────────────────┘   └───────────────┘  │
│  70 free credits, no account                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ SHEET 25-09    │001│002│003│004│005│006│007│008│                         │
│                │009│010│011│012│013│014│015│016│    hover a take → plays │
│                │017│018│019│020│021│022│023│024│                         │
├──────────────────────────────────────────────────────────────────────────┤
│ MOVES   push in · pan · tilt · arc · handheld · rack focus               │
│ ▚ 14 strips, each a real render of that move, click to shoot with it ▞   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Home, 390px**
```
┌──────────────────────────────┐
│ GATE                   ≡     │
├──────────────────────────────┤
│ Make a frame. Then decide    │
│ how the camera moves over it.│
│ ┌──────────────────────────┐ │
│ │ describe a frame…        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ expose             2.0   │ │
│ └──────────────────────────┘ │
│ 70 free credits, no account  │
├──────────────────────────────┤
│ SHEET 25-09                  │
│ │001│002│  │003│004│         │
│ │005│006│  │007│008│         │
├──────────────────────────────┤
│ MOVES  ▚ strip, swipes ▞  →  │
└──────────────────────────────┘
```

**What it changes in the IA.**
- The two studios merge into one screen (`/shoot`): a frame and a take are steps in one loop, not two destinations.
- Assets becomes the sheet (`/sheet`): one grid, frame-numbered so an asset has an identity you can say out loud.
- Explore's themed grids collapse into one public sheet plus a moves strip.
- Pricing folds into `/stock` alongside the ledger.
- Nav goes from six items to three.

---

## Direction 2: The run log (chosen, as Docket)

**Idea.** The owner's direction, taken literally. What makes this build honest is that every generation is a run with a receipt: model, input, cost, result, refund. The design puts that record on the surface instead of hiding it behind badges. The app is a log you read downward, with the media sitting inside the entries.

**Names:** Docket, Ledger, Runbook

**Palette**
| Name | Hex | Role |
|---|---|---|
| Stock | `#FCFCFA` | page, the white of a printed record |
| Ink | `#14161A` | text and the heavy block edges |
| Field | `#EDEEEA` | entry blocks, inputs: the grid is made of filled blocks, not hairlines |
| Posted | `#0F6B4F` | credits in, refunds, "no charge" |
| Charged | `#B3341F` | credits out, failures |
| Live | `#2457E6` | focus rings, the running entry |

**Type.**
- **Public Sans** for language. It was drawn for government forms, so it's legible small and sits correctly next to a number.
- **JetBrains Mono** for the money column, with tabular figures.

In the build, the owner asked whether Public Sans's own tabular figures were enough. Measured, they were (0.00px spread across digits), so the mono face was dropped.

**The one memorable thing: the commit.**
- A single meter sits above the button and shows the price as you change the settings.
- Pressing the button does one orchestrated move: the meter drains, and the entry writes itself into the top of the log with the charge posted.
- The media area inside that entry opens as a skeleton at exactly the aspect it will fill.

It is the only animation in the product, and it is the product's argument.

**Create, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Docket            make    log    credits                  70.0 credits   │
├────────────────────────────────────────┬─────────────────────────────────┤
│ MAKE                                   │ LOG                             │
│ ┌────────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ describe an image…                 │ │ │ 09:41  image  running  ▓▓░░ │ │
│ └────────────────────────────────────┘ │ │ flux.1 schnell    −2.0      │ │
│ image ▸ camera move                    │ │ ┌───────────────┐           │ │
│ aspect 1:1   batch 1   flux.1 schnell  │ │ │   skeleton    │           │ │
│                                        │ │ └───────────────┘           │ │
│ cost   ▓▓▓▓▓▓▓▓░░░░░░░░░░  2.0         │ │─────────────────────────────│ │
│ after  68.0 credits                    │ │ 09:38  move   done    −30.0 │ │
│ ┌────────────────────────────────────┐ │ │ push in · 5s 720p · ffmpeg  │ │
│ │ make the image                     │ │ │ [ video ]  from image 0b41  │ │
│ └────────────────────────────────────┘ │ │─────────────────────────────│ │
│                                        │ │ 09:31  move   free     0.0  │ │
│ from: your last image ▾                │ │ example, not your image     │ │
└────────────────────────────────────────┴─┴─────────────────────────────┴─┘
```

**Create, 390px**
```
┌──────────────────────────────┐
│ Docket          70.0    ≡    │
├──────────────────────────────┤
│ image ▸        camera move   │
│ ┌──────────────────────────┐ │
│ │ describe an image…       │ │
│ └──────────────────────────┘ │
│ 1:1   batch 1                │
│ cost ▓▓▓▓▓░░░░░░  2.0        │
│ after 68.0                   │
│ ┌──────────────────────────┐ │
│ │ make the image           │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ LOG                          │
│ ┌──────────────────────────┐ │
│ │ 09:41 image running ▓▓░░ │ │
│ │ ┌──────────────────────┐ │ │
│ │ │      skeleton        │ │ │
│ │ └──────────────────────┘ │ │
│ ├──────────────────────────┤ │
│ │ 09:38 move  done  −30.0  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Home, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Docket            make    log    credits                      sign in    │
├──────────────────────────────────────────────────────────────────────────┤
│ Every image here was generated on request. Every video is a real render.  │
│ Every credit is on the record.                                            │
│ ┌────────────────────────────────────┐  ┌──────────────────────────────┐  │
│ │ describe an image…                 │  │ make the image      2.0      │  │
│ └────────────────────────────────────┘  └──────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│ PUBLIC LOG                                       today  ·  all            │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐            │
│ │ 09:41 image  │ 09:38 move   │ 09:31 image  │ 09:22 move   │            │
│ │ [ media    ] │ [ media    ] │ [ media    ] │ [ media    ] │            │
│ │ flux −2.0    │ push in −30  │ flux −2.0    │ tilt −30.0   │            │
│ └──────────────┴──────────────┴──────────────┴──────────────┘            │
│ 14 camera moves, each preview a real render        open a move ▸          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Home, 390px**
```
┌──────────────────────────────┐
│ Docket                 ≡     │
├──────────────────────────────┤
│ Every image here was         │
│ generated on request. Every  │
│ credit is on the record.     │
│ ┌──────────────────────────┐ │
│ │ describe an image…       │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ make the image     2.0   │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ PUBLIC LOG                   │
│ ┌──────────────────────────┐ │
│ │ 09:41 image  flux  −2.0  │ │
│ │ [ media                ] │ │
│ ├──────────────────────────┤ │
│ │ 09:38 move   push  −30.0 │ │
│ │ [ media                ] │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

(The all-caps labels in these wireframes, MAKE, LOG and PUBLIC LOG, were one of the owner's corrections: Docket uses sentence case throughout.)

**What it changes in the IA.**
- Assets disappears as a destination: the log *is* the library, with a media/list toggle.
- Credits stops being a separate ledger page, because the log is the ledger. `/credits` becomes the buy-and-balance page, with pricing merged in.
- Explore becomes the public log.
- The create screen keeps both steps in one place, with the log always beside it.

---

## Direction 3: Diptych

**Idea.** The product is one comparison: a still, and the same still with the camera moving over it. So the whole app is a single full-bleed stage holding that pair, with a divider you drag. Controls live in one bar at the bottom, and everything else arrives as a drawer over the stage.

**Names:** Tally, Push, Throughline

**Palette**
| Name | Hex | Role |
|---|---|---|
| Fog | `#F2F3F5` | the stage around the media, light so the app can't be mistaken for the reference |
| Ink | `#14161A` | type on fog |
| Steel | `#7A828C` | inactive controls, meta |
| Black | `#000000` | media surround only |
| Tally | `#FF3B2E` | one signal colour: recording, rendering, live. Nothing else is coloured. |

**Type.** **Chivo** and **Chivo Mono**, one superfamily. One family is a deliberate silence: when the media is the page, two typefaces are two voices too many.

**The one memorable thing: the handle.** A single vertical divider across the stage: drag left and you're looking at your still; drag right and the take plays. It's the hero, the review tool after every render, and the comparison in the library.

**Create, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tally                                         work    account    70.0    │
├──────────────────────────────────────────────────────────────────────────┤
│                                  ║                                       │
│        still (black surround)    ║    take playing, same frame           │
│                                  ║                                       │
│                                 ◄║►  drag                                │
│                                  ║                                       │
│  1024×1024  flux.1 schnell       ║   push in · 5s · 720p · ffmpeg        │
├──────────────────────────────────────────────────────────────────────────┤
│ [ describe an image…                            ]  1:1 ▾   make   2.0    │
│ move:  push in ▾   5s   720p                       render        30.0    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Create, 390px**
```
┌──────────────────────────────┐
│ Tally            70.0    ≡   │
├──────────────────────────────┤
│   still (black surround)     │
│ ═════════ ▲▼ drag ═══════════│
│   take playing               │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ describe an image…       │ │
│ └──────────────────────────┘ │
│ 1:1 ▾    ┌────────────────┐  │
│          │ make      2.0  │  │
│          └────────────────┘  │
│ move push in ▾  5s  720p     │
│          ┌────────────────┐  │
│          │ render   30.0  │  │
│          └────────────────┘  │
└──────────────────────────────┘
```

**Home, desktop**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tally                                              work   sign in        │
├──────────────────────────────────────────────────────────────────────────┤
│     a generated still            ║     the same still, camera pushing in │
│                                 ◄║►  drag to compare                     │
│   flux.1 schnell, on request     ║   rendered with ffmpeg, not diffusion │
├──────────────────────────────────────────────────────────────────────────┤
│  Make a still. Move the camera over it.                                  │
│  [ describe an image…                          ]   ┌──────────────────┐  │
│  70 free credits, no account                       │ make       2.0   │  │
│                                                    └──────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│ ▁▂▃ work drawer (pull up): filmstrip of recent public pairs ▃▂▁          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Home, 390px**
```
┌──────────────────────────────┐
│ Tally                   ≡    │
├──────────────────────────────┤
│    a generated still         │
│ ═════════ ▲▼ drag ═══════════│
│    the camera pushing in     │
├──────────────────────────────┤
│ Make a still. Move the       │
│ camera over it.              │
│ ┌──────────────────────────┐ │
│ │ make             2.0     │ │
│ └──────────────────────────┘ │
│ 70 free credits, no account  │
├──────────────────────────────┤
│ ▁▂▃ pull up for your work ▃▂▁│
└──────────────────────────────┘
```

**What it changes in the IA.**
- Three destinations: stage, work and account.
- Home *is* the stage.
- The library is a drawer over it.
- Credits, plans and checkout live in one sheet.

The risk, stated when it was offered: a drawer-and-sheet app is harder to deep-link and to screenshot for a reviewer.

---

## Self-review before they were shown

Each direction was checked against the patterns the owner ruled out, and three were revised:
- **Direction 1:** the first draft was warm cream paper with a serif and a rust accent. It became a cool printed grey with a single grotesque and a blue marker.
- **Direction 2:** the first draft had all-caps tracked labels over every log entry and hairline rules between columns. Entries became filled blocks. The owner still caught all-caps labels in the wireframes.
- **Direction 3:** the first draft was a dark stage with a single hot accent, which is the reference's own move. The stage became light fog, with the red limited to "something is running".
