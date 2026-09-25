import type { LogEntry } from "./entries";

// What a run is called everywhere it's listed: an image by its prompt, a camera move by what
// happened ("Camera move: Slow push-in"), never by the preset name alone.
export function runTitle(e: Pick<LogEntry, "vertical" | "presetName" | "prompt">): string {
  return e.vertical === "video" ? `Camera move: ${e.presetName ?? "unnamed"}` : e.prompt;
}

// For a camera move, the prompt of the still it moved over: what you chose, else what it was
// rendered over.
export function sourcePrompt(e: Pick<LogEntry, "vertical" | "inputAsset" | "renderedFrom">): string | null {
  return e.vertical === "video" ? (e.inputAsset?.prompt ?? e.renderedFrom?.prompt ?? null) : null;
}
