// Shortens text for titles and previews at a word boundary, with an ellipsis, never mid-word.
export function truncateWords(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  // A single very long word has no boundary to use; only then cut inside it.
  const head = space > max * 0.4 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,.;:!?-]+$/, "")}…`;
}
