# Capture test

Result: **PASS**, with one known defect (see [Known defects](#known-defects)).

Every prompt and every final response in this repo's Claude Code sessions is
written automatically to `.agent-logs/`, one file per session, by project
hooks committed in `.claude/settings.json`. Nothing needs to be run by hand.

## Tool and model

| | |
| :-- | :-- |
| Tool | Claude Code 2.1.270, in the Claude desktop app (Code tab) |
| Model | `claude-opus-5` (Opus 5) |
| Planner vs executor | Same model for both. No plan mode, no subagents, no second model. |

Verified from the session transcripts: every assistant entry in both canary
sessions carries `message.model: "claude-opus-5"`.

## Mechanism

Claude Code **hooks**, checked against the live docs at
`https://code.claude.com/docs/en/hooks.md` (not written from memory).

- Config file changed: [`.claude/settings.json`](.claude/settings.json)
  (project scope, committed; user-level `~/.claude/settings.json` untouched)
- Hook script: [`scripts/capture.py`](scripts/capture.py), standard library
  only, runs on the macOS system `python3` (3.9)

| Event | What the script does |
| :-- | :-- |
| `UserPromptSubmit` | Appends a `PROMPT` entry with stdin `prompt`, verbatim |
| `Stop` | Appends a `RESPONSE` entry: the text of the final assistant message, read from `transcript_path` (thinking and tool calls excluded). Falls back to stdin `last_assistant_message` if the transcript has not flushed within 2s |
| `StopFailure` | Turn ended on an API error: appends a `RESPONSE` entry saying so, with `error`, `error_details`, the rendered error and any partial text |
| `SessionEnd`, `SessionStart` | If the latest prompt has no response (Esc interrupts fire **no** hook), appends a `RESPONSE` entry saying the turn was interrupted (from the transcript's `[Request interrupted by user]` marker) or ended with no recorded cause |
| `PostModelSwitch` | Remembers the new model so a mid-build switch shows in later entries |

`UserPromptSubmit` does the same unanswered-prompt check before it appends
the new prompt, so an interrupted turn is closed out as soon as the next
prompt arrives.

Safety properties: never exits 2 (which would block a prompt or keep a turn
running), never writes stdout (which `UserPromptSubmit` would inject into the
model's context), 10s timeout. On any exception it appends the traceback to
`.agent-logs/_capture-errors.log` and exits 1, which Claude Code shows as a
visible `hook error` notice while letting the turn proceed. The script
rewrites the front matter (`total_exchanges`, `last_prompt_time`, `model`)
on every write.

## Canary 1: existing session `48cab46d`

Sent in the desktop app, in the session that installed the hooks. It also
shows that hooks added mid-session were picked up without a restart.

Log file: [`.agent-logs/2026-09-14_15-07-50_48cab46d-fe12-42e7-9fd5-2735b79789c6.md`](.agent-logs/2026-09-14_15-07-50_48cab46d-fe12-42e7-9fd5-2735b79789c6.md)

```text
[LOG_ENTRY type=PROMPT num=6 session=48cab46d]
timestamp: 2026-09-14T18:24:51.858Z
model: claude-opus-5

CAPTURE TEST — 8x assignment, mnahsanofficial

[LOG_ENTRY type=RESPONSE num=6 session=48cab46d]
timestamp: 2026-09-14T18:25:00.820Z
model: claude-opus-5

Canary 1 received. The prompt is logged as PROMPT 6 at `2026-09-14T18:24:51.858Z` in `.agent-logs/2026-09-14_15-07-50_48cab46d-fe12-42e7-9fd5-2735b79789c6.md`, with `total_exchanges: 6`. This reply is written as RESPONSE 6 when this turn ends.

Now send the same canary from a new Code session in this folder, then come back here. I'll check both files and do the `chore/capture-verification` branch.
```

## Canary 2: fresh session `af7b7994`

Sent from a brand-new Code session opened in this folder. It landed in its
own new file, with its own session id and numbering starting at 1.

Log file: [`.agent-logs/2026-09-14_18-26-51_af7b7994-8bcc-4ae9-822f-5c179973abed.md`](.agent-logs/2026-09-14_18-26-51_af7b7994-8bcc-4ae9-822f-5c179973abed.md)

```text
[LOG_ENTRY type=PROMPT num=1 session=af7b7994]
timestamp: 2026-09-14T18:26:51.846Z
model: unknown

CAPTURE TEST — 8x assignment, mnahsanofficial

[LOG_ENTRY type=RESPONSE num=1 session=af7b7994]
timestamp: 2026-09-14T18:26:56.592Z
model: claude-opus-5

Got your capture test message: **"CAPTURE TEST — 8x assignment, mnahsanofficial"**.

I haven't run anything or changed any files. If this was meant to check that the agent log capture from PR #1 is working, look in `.agent-logs/` for a new session log that contains this line. Git already shows `.agent-logs/2026-09-14_15-07-50_48cab46d-….md` as modified, so logs do seem to be getting written.

What's next for the 8x assignment?
```

Strict checks run on both files before this document was written:

- Two files, two different `session_id`s; the canary prompt appears exactly
  once in each.
- Neither file contains the other session's entries. Each transcript holds
  only its own `sessionId`.
- Session two's logged response is byte-identical to the final message in
  its own transcript.

## Live error-path capture: rate limit

Not staged. A workflow prompt in session `48cab46d` hit the account's session
limit. `Stop` did not fire; `StopFailure` did, and the script recorded the
turn as errored instead of leaving a silent hole. The next prompt,
"Try again", is PROMPT 3 in the same file. Raw entry:

```text
[LOG_ENTRY type=RESPONSE num=2 session=48cab46d]
timestamp: 2026-09-14T15:18:54.226Z
model: claude-opus-5

TURN ENDED WITH AN API ERROR - no final response.

error: rate_limit
error_details: (none)
rendered error: You've hit your session limit · resets 12:10am (Asia/Dhaka)

Partial assistant text produced before the error: (none)
```

## What was tried first and did not work

1. **Canary through the bundled Claude Code CLI (`claude -p`).** No command
   could open a new desktop session, so the first fresh-session canary went
   through the CLI inside the desktop app bundle.
   - The first binary found, under `claude-code-vm/`, is a Linux ARM ELF
     build for the app's VM: `exec format error` on macOS.
   - The macOS build, under `claude-code/2.1.270/claude.app`, ran. The
     committed project hook fired in that fresh session and logged the prompt.
     But the CLI has no login of its own (auth lives in the desktop app). It
     replied `Not logged in · Please run /login`, so no model response and no
     `Stop` entry. `StopFailure` was not wired yet at that point, so the log
     has a prompt with no response. Kept unedited as evidence:
   [`.agent-logs/2026-09-14_15-03-14_290f5dad-3144-461f-ac21-e6ba57bb433a.md`](.agent-logs/2026-09-14_15-03-14_290f5dad-3144-461f-ac21-e6ba57bb433a.md)

   ```text
   [LOG_ENTRY type=PROMPT num=1 session=290f5dad]
   timestamp: 2026-09-14T15:03:14.110Z
   model: unknown

   CAPTURE TEST — 8x assignment, mnahsanofficial
   ```

2. **Wiring only `Stop`.** The first version captured normal turns only. The
   docs say `Stop` "does not run if the stoppage occurred due to a user
   interrupt" and that API errors fire `StopFailure` instead, so interrupted
   or errored turns would have left prompts with no response. `StopFailure`,
   `SessionEnd` and the unanswered-prompt check were added before the first
   commit. The rate-limit entry above is that path working live.

3. **Reading the response only from the transcript.** The docs warn that
   the transcript "may lag". The script reads the transcript, as specified,
   but checks it against stdin `last_assistant_message` and uses that copy
   if the transcript has not caught up within 2 seconds.

4. **Offline test harness mistakes (tests, not the hook).** zsh's `echo`
   expanded `\n` inside the JSON, which made invalid stdin; switched to
   `printf '%s'`. A copied mid-turn transcript correctly yielded no final
   response, so an end-of-turn entry had to be appended to test extraction.

## Known defects

- **`model: unknown` on the first prompt of a new session.** Session
  `af7b7994`, PROMPT 1. `UserPromptSubmit` stdin has no model field. On the
  first prompt no assistant message exists to read one from, and the desktop
  app's `SessionStart` payload did not supply `model`. The `RESPONSE` entry
  and the front matter show the correct model. The entry stays as written.
  A fix goes in its own `fix/` branch.

## Fragile points to watch during the build

- **Workspace trust.** Interactive sessions hold back all settings-file hooks
  until the folder is trusted. A new clone or folder captures nothing until
  trust is accepted.
- **`python3` on the hook's PATH.** If it is missing, every hook fails with a
  visible `hook error` notice and nothing is logged. Watch for that notice.
- **Silent failure modes.** `_capture-errors.log` only catches failures inside
  the script. Two things log nothing at all: a disabled hook
  (`disableAllHooks`, or an edit to `.claude/settings.json`) and a session
  started outside this folder. The quick check: each new prompt should add a
  `PROMPT` entry with a rising `total_exchanges`.
- **Interrupt entries are written late.** No hook fires on Esc, so the
  `RESPONSE` for an interrupted turn is written by the next hook event. If the
  app is killed and the session is never resumed, that turn stays open.
- **Transcript format is undocumented.** The interrupt marker and entry
  shapes are observed behaviour of 2.1.270, not a documented contract. After
  an update, check that a normal turn still logs its full final response.
- **Logs cross branch boundaries.** Each turn's final response is written
  after that turn's last commit, so it lands in the next branch's first
  commit. Nothing is edited. Switch branches without discarding changes
  (`git switch -C main origin/main`, never `--discard-changes`).
