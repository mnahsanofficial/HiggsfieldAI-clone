#!/usr/bin/env python3
"""Claude Code hook: capture each prompt and final response into .agent-logs/.

Wired from .claude/settings.json. Reads the hook JSON from stdin and dispatches
on `hook_event_name`:

  SessionStart     -> remember the active model (stdin `model`, when present);
                      close out an unanswered prompt (see below)
  PostModelSwitch  -> remember the new model (`to_model`)
  UserPromptSubmit -> close out an unanswered prompt, then append a PROMPT
                      entry with `prompt` verbatim
  Stop             -> append a RESPONSE entry with the final assistant text,
                      read from `transcript_path` (falls back to
                      `last_assistant_message` if the transcript lags)
  StopFailure      -> append a RESPONSE entry saying the turn ended with an API
                      error, with the error and any partial assistant text
  SessionEnd       -> close out an unanswered prompt

Unanswered prompts: Claude Code fires no hook when the user interrupts a turn
(Esc) -- Stop "does not run if the stoppage occurred due to a user interrupt".
So the next hook event that runs checks whether the latest PROMPT has a
RESPONSE; if not, it appends one stating that the turn was interrupted (when
the transcript holds the "[Request interrupted by user" marker) or that it
ended without a recorded cause, plus any partial assistant text.

Every writing event rewrites the front matter in place.

Rules this script keeps:
  * Standard library only; runs on the macOS system python3 (3.9).
  * Never exits 2 (exit 2 would block the prompt or keep the turn running).
  * Never prints to stdout (UserPromptSubmit stdout is injected into context).
  * On any failure: traceback appended to .agent-logs/_capture-errors.log,
    first line to stderr, exit 1 -> Claude Code shows a visible
    "hook error" notice in the transcript, and the turn proceeds.
"""

import datetime
import fcntl
import glob
import json
import os
import sys
import tempfile
import time
import traceback

AUTHOR = "mnahsanofficial"
PROJECT = "higgsfieldai-clone"
TOOL = "claude-code"
TRANSCRIPT_WAIT_SECONDS = 2.0

FM_KEYS = [
    "session_id", "date", "author", "model", "tool", "project",
    "total_exchanges", "first_prompt_time", "last_prompt_time",
]


def utc_now():
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (now.microsecond // 1000)


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def log_dir(data):
    path = os.path.join(project_dir(data), ".agent-logs")
    os.makedirs(path, exist_ok=True)
    return path


# ---------------------------------------------------------------- model state
# Kept outside the repo: it is a cache, not part of the record.

def state_path(session_id):
    d = os.path.join(tempfile.gettempdir(), "claude-capture")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, session_id + ".json")


def load_state(session_id):
    try:
        with open(state_path(session_id)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(session_id, state):
    with open(state_path(session_id), "w") as f:
        json.dump(state, f)


# ----------------------------------------------------------------- transcript

def read_transcript(path):
    entries = []
    if not path or not os.path.exists(path):
        return entries
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue  # a partially flushed last line
    return entries


def last_model_in(entries):
    for e in reversed(entries):
        if e.get("type") == "assistant" and not e.get("isSidechain"):
            model = (e.get("message") or {}).get("model")
            if model and model != "<synthetic>":
                return model
    return None


def final_response_in(entries):
    """Text blocks of the last assistant message run after the last user entry.

    Assistant output is stored one content block per line; any `user` entry
    (a prompt or a tool_result) starts a new run, so what remains at the end
    is the final message of the turn. Thinking and tool_use blocks are skipped.
    """
    texts, ts, model = [], None, None
    for e in entries:
        if e.get("isSidechain"):
            continue
        kind = e.get("type")
        if kind == "user":
            texts, ts, model = [], None, None
        elif kind == "assistant":
            msg = e.get("message") or {}
            content = msg.get("content")
            blocks = [{"type": "text", "text": content}] if isinstance(content, str) else (content or [])
            for b in blocks:
                if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                    texts.append(b["text"])
                    ts = e.get("timestamp")
                    model = msg.get("model") or model
    if not texts:
        return None, None, None
    return "\n\n".join(texts), ts, model


def norm(s):
    return " ".join((s or "").split())


INTERRUPT_MARKER = "[Request interrupted by user"


def user_text(e):
    """Text of a main-chain user entry, or None for tool results / meta."""
    if e.get("type") != "user" or e.get("isSidechain") or e.get("isMeta") or "toolUseResult" in e:
        return None
    content = (e.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return None
    if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
        return None
    return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def partial_turn_in(entries, exclude_prompt_id=None):
    """What the transcript holds for the turn after the last real prompt.

    Returns (assistant text blocks, interrupt marker timestamp or None,
    timestamp of the last of those, model). `exclude_prompt_id` skips entries
    of a prompt that is being submitted right now.
    """
    def skip(e):
        return e.get("isSidechain") or (exclude_prompt_id and e.get("promptId") == exclude_prompt_id)

    start = 0
    for i, e in enumerate(entries):
        text = None if skip(e) else user_text(e)
        if text and not text.startswith(INTERRUPT_MARKER):
            start = i + 1
    texts, marker_ts, last_ts, model = [], None, None, None
    for e in entries[start:]:
        if skip(e):
            continue
        text = user_text(e)
        if text and text.startswith(INTERRUPT_MARKER):
            marker_ts = last_ts = e.get("timestamp") or last_ts
        elif e.get("type") == "assistant":
            msg = e.get("message") or {}
            if msg.get("model") == "<synthetic>":
                continue  # locally rendered errors, not model output
            content = msg.get("content")
            blocks = [{"type": "text", "text": content}] if isinstance(content, str) else (content or [])
            for b in blocks:
                if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                    texts.append(b["text"])
                    last_ts = e.get("timestamp") or last_ts
            model = msg.get("model") or model
    return texts, marker_ts, last_ts, model


def partial_section(texts, what):
    if not texts:
        return "Partial assistant text produced before the %s: (none)\n" % what
    return "Partial assistant text produced before the %s:\n\n%s\n" % (what, "\n\n".join(texts))


# ------------------------------------------------------------------ log file

def session_file(data, session_id):
    matches = sorted(glob.glob(os.path.join(log_dir(data), "*_%s.md" % session_id)))
    if matches:
        return matches[0], True
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    return os.path.join(log_dir(data), "%s_%s.md" % (stamp, session_id)), False


def parse_front_matter(text):
    fm = {}
    if not text.startswith("---\n"):
        return fm
    end = text.find("\n---\n", 4)
    for line in text[4:end].splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            fm[k.strip()] = v.strip()
    return fm


def render(fm, body):
    short = fm["session_id"].split("-")[0]
    head = "---\n" + "".join("%s: %s\n" % (k, fm[k]) for k in FM_KEYS) + "---\n\n"
    head += "# Session Log - %s\n\n" % fm["date"]
    head += "Session: `%s` | Project: `%s` | Author: `%s`\n\n---\n\n" % (short, fm["project"], fm["author"])
    return head + body


def entry(kind, num, session_id, timestamp, model, text):
    short = session_id.split("-")[0]
    if not text.endswith("\n"):
        text += "\n"
    return "[LOG_ENTRY type=%s num=%d session=%s]\ntimestamp: %s\nmodel: %s\n\n%s\n" % (
        kind, num, short, timestamp, model, text)


def append(data, session_id, make_entry):
    """Lock, read, add an entry, rewrite front matter, atomically replace."""
    lock_path = state_path(session_id) + ".lock"
    with open(lock_path, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path, exists = session_file(data, session_id)
        text = ""
        if exists:
            with open(path, encoding="utf-8") as f:
                text = f.read()
        fm = parse_front_matter(text)
        marker = text.find("\n[LOG_ENTRY ")
        body = text[marker + 1:] if marker != -1 else ""
        if not fm:
            fm = {
                "session_id": session_id,
                "date": os.path.basename(path)[:10],
                "author": AUTHOR,
                "model": "unknown",
                "tool": TOOL,
                "project": PROJECT,
                "total_exchanges": "0",
                "first_prompt_time": "",
                "last_prompt_time": "",
            }
        new = make_entry(fm, body)
        if new is None:
            return
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(render(fm, body + new))
        os.replace(tmp, path)


# -------------------------------------------------------------------- events

def has_response(fm, body):
    num = int(fm["total_exchanges"])
    header = "[LOG_ENTRY type=RESPONSE num=%d session=%s]\n" % (num, fm["session_id"].split("-")[0])
    return num == 0 or body.startswith(header) or ("\n" + header) in body


def close_unanswered(data, session_id, fm, body, exclude_prompt_id=None):
    """RESPONSE entry for a latest PROMPT that never got one, else ""."""
    if has_response(fm, body):
        return ""
    now = utc_now()
    entries = read_transcript(data.get("transcript_path"))
    texts, marker_ts, last_ts, model = partial_turn_in(entries, exclude_prompt_id)
    model = model or fm.get("model") or "unknown"
    detected = ("Claude Code fires no hook when a turn ends this way, so this entry was "
                "written afterwards, at %s, when the next hook event (%s) ran."
                % (now, data.get("hook_event_name")))
    if marker_ts:
        text = ("TURN INTERRUPTED BY THE USER - no final response.\n\n%s The interrupt is "
                "taken from the transcript's \"[Request interrupted by user]\" marker at %s.\n\n%s"
                % (detected, marker_ts, partial_section(texts, "interrupt")))
        ts = marker_ts
    else:
        text = ("TURN ENDED WITHOUT A RESPONSE - cause not recorded.\n\nNo Stop or StopFailure "
                "event was captured for this turn and the transcript holds no interrupt marker. "
                "%s Possible causes: the app was closed or the session switched mid-turn, or the "
                "capture hook failed (see .agent-logs/_capture-errors.log).\n\n%s"
                % (detected, partial_section(texts, "turn ended")))
        ts = last_ts or now
    return entry("RESPONSE", int(fm["total_exchanges"]), session_id, ts, model, text)


def on_close_out(data, session_id):
    if not session_file(data, session_id)[1]:
        return  # nothing captured in this session yet

    def make(fm, body):
        return close_unanswered(data, session_id, fm, body) or None

    append(data, session_id, make)


def on_prompt(data, session_id):
    prompt = data.get("prompt")
    if prompt is None:
        raise ValueError("UserPromptSubmit stdin has no `prompt` field")
    ts = utc_now()
    model = (load_state(session_id).get("model")
             or last_model_in(read_transcript(data.get("transcript_path")))
             or os.environ.get("ANTHROPIC_MODEL")
             or "unknown")

    def make(fm, body):
        closed = close_unanswered(data, session_id, fm, body, data.get("prompt_id"))
        num = int(fm["total_exchanges"]) + 1
        fm["total_exchanges"] = str(num)
        fm["first_prompt_time"] = fm["first_prompt_time"] or ts
        fm["last_prompt_time"] = ts
        fm["model"] = model
        return closed + entry("PROMPT", num, session_id, ts, model, prompt)

    append(data, session_id, make)


def on_stop(data, session_id):
    stdin_text = data.get("last_assistant_message")
    deadline = time.time() + TRANSCRIPT_WAIT_SECONDS
    while True:
        entries = read_transcript(data.get("transcript_path"))
        text, ts, model = final_response_in(entries)
        # The transcript is flushed asynchronously; wait briefly until it holds
        # the same final text Claude Code handed us on stdin.
        if stdin_text is None or (text is not None and norm(text) == norm(stdin_text)):
            break
        if time.time() >= deadline:
            text, ts = stdin_text, None  # transcript lagged: use the stdin copy
            break
        time.sleep(0.1)
    if text is None:
        raise ValueError("no final assistant text in transcript or stdin")
    model = model or last_model_in(entries) or load_state(session_id).get("model") or "unknown"
    state = load_state(session_id)
    state["model"] = model
    save_state(session_id, state)
    ts = ts or utc_now()

    def make(fm, body):
        num = int(fm["total_exchanges"])
        if num == 0:
            return None  # no captured prompt in this session to pair with
        fm["model"] = model
        return entry("RESPONSE", num, session_id, ts, model, text)

    append(data, session_id, make)


def on_stop_failure(data, session_id):
    ts = utc_now()
    entries = read_transcript(data.get("transcript_path"))
    texts, _, _, model = partial_turn_in(entries)
    model = model or last_model_in(entries) or load_state(session_id).get("model") or "unknown"
    text = ("TURN ENDED WITH AN API ERROR - no final response.\n\n"
            "error: %s\nerror_details: %s\nrendered error: %s\n\n%s" % (
                data.get("error") or "(none)",
                data.get("error_details") or "(none)",
                data.get("last_assistant_message") or "(none)",
                partial_section(texts, "error")))

    def make(fm, body):
        num = int(fm["total_exchanges"])
        if num == 0:
            return None
        fm["model"] = model
        return entry("RESPONSE", num, session_id, ts, model, text)

    append(data, session_id, make)


def main():
    data = json.loads(sys.stdin.read() or "{}")
    event = data.get("hook_event_name") or (sys.argv[1] if len(sys.argv) > 1 else "")
    session_id = data.get("session_id")
    if not session_id:
        raise ValueError("hook stdin has no `session_id`")
    if event == "SessionStart":
        if data.get("model"):
            save_state(session_id, dict(load_state(session_id), model=data["model"]))
        on_close_out(data, session_id)
    elif event == "PostModelSwitch":
        if data.get("to_model"):
            save_state(session_id, dict(load_state(session_id), model=data["to_model"]))
    elif event == "UserPromptSubmit":
        on_prompt(data, session_id)
    elif event == "Stop":
        on_stop(data, session_id)
    elif event == "StopFailure":
        on_stop_failure(data, session_id)
    elif event == "SessionEnd":
        on_close_out(data, session_id)


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:  # noqa: BLE001 - must never escape as exit 2
        try:
            root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
            os.makedirs(os.path.join(root, ".agent-logs"), exist_ok=True)
            with open(os.path.join(root, ".agent-logs", "_capture-errors.log"), "a") as f:
                f.write("%s %s\n%s\n" % (utc_now(), " ".join(sys.argv), traceback.format_exc()))
        except BaseException:
            pass
        sys.stderr.write("CAPTURE HOOK FAILED (.agent-logs not updated): %r\n" % (exc,))
        sys.exit(1)
